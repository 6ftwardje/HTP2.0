"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { generateTranscriptEnrichmentAdmin } from "@/lib/ai/transcript-enrichment-job";
import { getMuxPlaybackTokens } from "@/lib/mux-signing";
import { createClient } from "@/lib/supabase/server";
import { TranscriptionProviderError } from "@/lib/transcription/contracts";
import { validateReviewTransition } from "@/lib/transcription/review-policy";
import { MuxCaptionProvider } from "@/lib/transcription/mux-captions";
import { failureTransition } from "@/lib/transcription/workflow";
import { parseWebVtt } from "@/lib/transcription/vtt";
import type { TranscriptEnrichment } from "@/lib/transcription/enrichment";

type ReviewActionResult = { success: boolean; error?: string };
type WorkflowActionResult = {
  success: boolean;
  state?: "waiting_review" | "completed" | "busy" | "backoff" | "dead_letter";
  error?: string;
};

class WorkflowFailure extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "WorkflowFailure";
  }
}

async function loadReviewContext(enrichmentId: string, weeklyUpdateId: number) {
  const db = await createClient();
  const { data, error } = await db
    .from("ai_video_enrichments")
    .select("id, status, transcript_id, transcript:ai_video_transcripts!inner(weekly_update_id, weekly_update:weekly_updates!inner(video_duration_seconds, slug))")
    .eq("id", enrichmentId)
    .eq("transcript.weekly_update_id", weeklyUpdateId)
    .maybeSingle();
  if (error || !data) return { db, context: null, error: error?.message ?? "AI-concept niet gevonden." };

  const transcriptRelation = data.transcript as unknown as {
    weekly_update_id: number;
    weekly_update: { video_duration_seconds: number | null; slug: string } | Array<{ video_duration_seconds: number | null; slug: string }>;
  };
  const weeklyUpdate = Array.isArray(transcriptRelation.weekly_update)
    ? transcriptRelation.weekly_update[0]
    : transcriptRelation.weekly_update;
  return {
    db,
    context: {
      id: data.id as string,
      transcriptId: data.transcript_id as string,
      status: data.status as string,
      durationSeconds: weeklyUpdate?.video_duration_seconds ?? null,
      slug: weeklyUpdate?.slug ?? null,
    },
    error: null,
  };
}

async function mutateReview(input: {
  enrichmentId: string;
  weeklyUpdateId: number;
  content?: TranscriptEnrichment;
  action: "save" | "publish" | "reject";
  confirmed?: boolean;
}): Promise<ReviewActionResult> {
  const { actorStudent } = await requireAdmin();
  if (!input.enrichmentId || !Number.isInteger(input.weeklyUpdateId)) {
    return { success: false, error: "Ongeldige reviewaanvraag." };
  }
  const loaded = await loadReviewContext(input.enrichmentId, input.weeklyUpdateId);
  if (!loaded.context) return { success: false, error: loaded.error ?? undefined };
  if (!loaded.context.durationSeconds) {
    return { success: false, error: "Videoduur ontbreekt; publicatie is geblokkeerd." };
  }
  const transition = validateReviewTransition({
    currentStatus: loaded.context.status,
    content: input.content,
    durationSeconds: loaded.context.durationSeconds,
    action: input.action,
    confirmed: input.confirmed,
  });
  if (!transition.ok) return { success: false, error: transition.reason };

  const now = new Date().toISOString();
  const update = input.action === "reject"
    ? {
        status: "rejected",
        reviewed_by: actorStudent.id,
        reviewed_at: now,
        published_at: null,
      }
    : {
        status: input.action === "publish" ? "published" : "review",
        summary: transition.content?.summary,
        key_takeaways: transition.content?.keyTakeaways,
        chapters: transition.content?.chapters,
        reviewed_content: transition.content,
        reviewed_by: actorStudent.id,
        reviewed_at: now,
        published_at: input.action === "publish" ? now : null,
      };

  const { data: updated, error } = await loaded.db
    .from("ai_video_enrichments")
    .update(update)
    .eq("id", input.enrichmentId)
    .in("status", ["draft", "review"])
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { success: false, error: error?.message ?? "Het concept is intussen gewijzigd; vernieuw de pagina." };
  }

  if (input.action === "publish" || input.action === "reject") {
    await loaded.db
      .from("ai_video_workflows")
      .update({
        step: "complete",
        status: "completed",
        next_attempt_at: null,
        lease_token: null,
        lease_expires_at: null,
      })
      .eq("transcript_id", loaded.context.transcriptId)
      .eq("status", "waiting_review");
  }

  logAdminAction(`weekly_update.enrichment_${input.action}`, {
    actorStudentId: actorStudent.id,
    metadata: {
      weeklyUpdateId: input.weeklyUpdateId,
      enrichmentId: input.enrichmentId,
    },
  });
  revalidatePath("/admin/market-analysis");
  if (loaded.context.slug) revalidatePath(`/market-analysis/${loaded.context.slug}`);
  return { success: true };
}

export async function adminSaveEnrichmentReview(
  enrichmentId: string,
  weeklyUpdateId: number,
  content: TranscriptEnrichment
) {
  return mutateReview({ enrichmentId, weeklyUpdateId, content, action: "save" });
}

export async function adminPublishEnrichment(
  enrichmentId: string,
  weeklyUpdateId: number,
  content: TranscriptEnrichment,
  confirmed: boolean
) {
  return mutateReview({ enrichmentId, weeklyUpdateId, content, action: "publish", confirmed });
}

export async function adminRejectEnrichment(enrichmentId: string, weeklyUpdateId: number) {
  return mutateReview({ enrichmentId, weeklyUpdateId, action: "reject" });
}

function workflowFailure(error: unknown) {
  if (error instanceof WorkflowFailure) return error;
  if (error instanceof TranscriptionProviderError) {
    return new WorkflowFailure(`mux_${error.code}`, error.retryable, error.message);
  }
  return new WorkflowFailure(
    "workflow_unexpected",
    true,
    "De verwerking is onverwacht onderbroken. Probeer later opnieuw."
  );
}

async function updateClaimedWorkflow(
  db: Awaited<ReturnType<typeof createClient>>,
  workflowId: string,
  leaseToken: string,
  update: Record<string, unknown>
) {
  const { data, error } = await db
    .from("ai_video_workflows")
    .update(update)
    .eq("id", workflowId)
    .eq("lease_token", leaseToken)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new WorkflowFailure(
      "workflow_lease_lost",
      true,
      "De verwerkingslease is verlopen; vernieuw en probeer opnieuw."
    );
  }
}

export async function adminRunTranscriptWorkflow(
  transcriptId: string,
  weeklyUpdateId: number,
  confirmedPaidAiCall: boolean
): Promise<WorkflowActionResult> {
  const { actorStudent } = await requireAdmin();
  if (!transcriptId || !Number.isInteger(weeklyUpdateId) || !confirmedPaidAiCall) {
    return { success: false, error: "Bevestig de mogelijke betaalde AI-call." };
  }

  const db = await createClient();
  const { data: claimData, error: claimError } = await db
    .rpc("claim_ai_video_workflow", {
      p_transcript_id: transcriptId,
      p_lease_seconds: 600,
    })
    .single();
  if (claimError || !claimData) {
    return { success: false, error: claimError?.message ?? "Workflowclaim mislukt." };
  }
  const claim = claimData as {
    workflow_id: string;
    claimed: boolean;
    lease_token: string | null;
    attempt_count: number;
    max_attempts: number;
    workflow_status: string;
  };
  if (!claim.claimed || !claim.lease_token) {
    if (claim.workflow_status === "waiting_review" || claim.workflow_status === "completed") {
      return { success: true, state: claim.workflow_status as "waiting_review" | "completed" };
    }
    if (claim.workflow_status === "dead_letter") {
      return { success: false, state: "dead_letter", error: "Menselijke herstart is vereist." };
    }
    return {
      success: false,
      state: claim.workflow_status === "failed" ? "backoff" : "busy",
      error: claim.workflow_status === "failed"
        ? "De retry-wachttijd is nog niet verstreken."
        : "Deze video wordt al verwerkt.",
    };
  }

  try {
    const { data, error } = await db
      .from("ai_video_transcripts")
      .select("id, weekly_update_id, status, provider_track_id, weekly_update:weekly_updates!inner(id, mux_playback_id, mux_playback_policy, video_duration_seconds)")
      .eq("id", transcriptId)
      .eq("weekly_update_id", weeklyUpdateId)
      .maybeSingle();
    if (error || !data) {
      throw new WorkflowFailure("transcript_not_found", false, "Transcript niet gevonden.");
    }
    const relation = data.weekly_update as unknown as {
      id: number;
      mux_playback_id: string | null;
      mux_playback_policy: "public" | "signed";
      video_duration_seconds: number | null;
    } | Array<{
      id: number;
      mux_playback_id: string | null;
      mux_playback_policy: "public" | "signed";
      video_duration_seconds: number | null;
    }>;
    const update = Array.isArray(relation) ? relation[0] : relation;
    if (!update?.mux_playback_id || !update.video_duration_seconds) {
      throw new WorkflowFailure("video_metadata_missing", false, "Mux-playback of videoduur ontbreekt.");
    }

    if (data.status !== "ready") {
      if (data.status !== "processing" || !data.provider_track_id) {
        throw new WorkflowFailure("caption_not_ready", true, "Mux-captions zijn nog niet gereed.");
      }
      const tokenId = process.env.MUX_TOKEN_ID;
      const tokenSecret = process.env.MUX_TOKEN_SECRET;
      if (!tokenId || !tokenSecret) {
        throw new WorkflowFailure("mux_configuration_missing", false, "Mux-configuratie ontbreekt.");
      }
      const signedTokens = getMuxPlaybackTokens({
        playbackId: update.mux_playback_id,
        playbackPolicy: update.mux_playback_policy,
        durationSeconds: update.video_duration_seconds,
      });
      if (update.mux_playback_policy === "signed" && !signedTokens?.playback) {
        throw new WorkflowFailure("mux_signing_missing", false, "Mux-signingconfiguratie ontbreekt.");
      }
      const provider = new MuxCaptionProvider(tokenId, tokenSecret);
      const vtt = await provider.getWebVtt(
        update.mux_playback_id,
        data.provider_track_id,
        signedTokens?.playback
      );
      const segments = parseWebVtt(vtt);
      const lastEnd = segments.at(-1)?.endSeconds ?? 0;
      if (!segments.length || lastEnd > update.video_duration_seconds + 2) {
        throw new WorkflowFailure("invalid_transcript_timeline", false, "Het transcript heeft een ongeldige tijdlijn.");
      }
      const { data: saved, error: saveError } = await db
        .from("ai_video_transcripts")
        .update({
          transcript: segments,
          status: "ready",
          ready_at: new Date().toISOString(),
          failed_at: null,
          failure_code: null,
          failure_retryable: false,
        })
        .eq("id", transcriptId)
        .eq("status", "processing")
        .select("id")
        .maybeSingle();
      if (saveError || !saved) {
        throw new WorkflowFailure("transcript_save_failed", true, "Transcript kon niet worden opgeslagen.");
      }
    }

    await updateClaimedWorkflow(db, claim.workflow_id, claim.lease_token, { step: "enrich" });
    const generated = await generateTranscriptEnrichmentAdmin(transcriptId);
    if (generated.status === "failed") {
      let code = "enrichment_blocked";
      let retryable = false;
      if ("enrichmentId" in generated) {
        const { data: failed } = await db
          .from("ai_video_enrichments")
          .select("failure_code, failure_retryable")
          .eq("id", generated.enrichmentId)
          .maybeSingle();
        code = failed?.failure_code ?? code;
        retryable = failed?.failure_retryable === true;
      }
      throw new WorkflowFailure(code, retryable, generated.error);
    }

    const { data: enrichment } = await db
      .from("ai_video_enrichments")
      .select("status, failure_code, failure_retryable")
      .eq("id", generated.enrichmentId)
      .maybeSingle();
    if (!enrichment) {
      throw new WorkflowFailure("enrichment_missing", true, "AI-conceptstatus ontbreekt.");
    }
    if (enrichment.status === "processing") {
      throw new WorkflowFailure(
        "enrichment_outcome_unknown",
        false,
        "Een eerdere AI-call heeft een onbekende uitkomst; controleer handmatig om dubbels te voorkomen."
      );
    }
    if (enrichment.status === "failed") {
      throw new WorkflowFailure(
        enrichment.failure_code ?? "enrichment_failed",
        enrichment.failure_retryable === true,
        "Het AI-concept kon niet worden gegenereerd."
      );
    }
    const completed = enrichment.status === "published" || enrichment.status === "rejected";
    await updateClaimedWorkflow(db, claim.workflow_id, claim.lease_token, {
      step: completed ? "complete" : "review",
      status: completed ? "completed" : "waiting_review",
      next_attempt_at: null,
      lease_token: null,
      lease_expires_at: null,
      last_error_code: null,
      last_error_retryable: false,
    });
    logAdminAction("weekly_update.transcription_workflow_run", {
      actorStudentId: actorStudent.id,
      metadata: { weeklyUpdateId, transcriptId, workflowId: claim.workflow_id },
    });
    revalidatePath("/admin/market-analysis");
    return { success: true, state: completed ? "completed" : "waiting_review" };
  } catch (error) {
    const failure = workflowFailure(error);
    const transition = failureTransition({
      attemptCount: claim.attempt_count,
      maxAttempts: claim.max_attempts,
      retryable: failure.retryable,
    });
    await db
      .from("ai_video_workflows")
      .update({
        status: transition.status,
        next_attempt_at: transition.nextAttemptAt,
        lease_token: null,
        lease_expires_at: null,
        last_error_code: failure.code,
        last_error_retryable: failure.retryable,
      })
      .eq("id", claim.workflow_id)
      .eq("lease_token", claim.lease_token);
    return {
      success: false,
      state: transition.status === "dead_letter" ? "dead_letter" : "backoff",
      error: failure.message,
    };
  }
}

export async function adminRestartTranscriptWorkflow(
  transcriptId: string,
  weeklyUpdateId: number,
  confirmed: boolean
): Promise<WorkflowActionResult> {
  const { actorStudent } = await requireAdmin();
  if (!confirmed) return { success: false, error: "Bevestig de handmatige herstart." };
  const db = await createClient();
  const { data, error } = await db
    .from("ai_video_workflows")
    .update({
      status: "pending",
      attempt_count: 0,
      next_attempt_at: null,
      lease_token: null,
      lease_expires_at: null,
      last_error_code: null,
      last_error_retryable: false,
    })
    .eq("transcript_id", transcriptId)
    .in("status", ["failed", "dead_letter"])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Deze workflow kan nu niet worden herstart." };
  }
  logAdminAction("weekly_update.transcription_workflow_restart", {
    actorStudentId: actorStudent.id,
    metadata: { weeklyUpdateId, transcriptId, workflowId: data.id },
  });
  return adminRunTranscriptWorkflow(transcriptId, weeklyUpdateId, true);
}
