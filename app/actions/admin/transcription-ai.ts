"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import { validateReviewTransition } from "@/lib/transcription/review-policy";
import type { TranscriptEnrichment } from "@/lib/transcription/enrichment";

type ReviewActionResult = { success: boolean; error?: string };

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
