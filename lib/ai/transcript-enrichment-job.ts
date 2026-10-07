import { requireAdmin } from "@/lib/admin/access";
import { getFeatureConfig } from "@/lib/ai/registry";
import { AnthropicTranscriptEnrichmentProvider } from "@/lib/ai/anthropic-transcript-enrichment";
import {
  executeTranscriptEnrichment,
  type EnrichmentJobStore,
  type EnrichmentPricing,
} from "@/lib/ai/transcript-enrichment";
import { createClient } from "@/lib/supabase/server";
import type { TranscriptSegment } from "@/lib/transcription/contracts";
import { TRANSCRIPT_ENRICHMENT_PROMPT_VERSION } from "@/lib/transcription/enrichment";

function positiveNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function getEnrichmentPricingFromEnvironment(): EnrichmentPricing | null {
  const input = positiveNumber(process.env.AI_ENRICHMENT_INPUT_EUR_PER_MILLION);
  const output = positiveNumber(process.env.AI_ENRICHMENT_OUTPUT_EUR_PER_MILLION);
  const validUntil = process.env.AI_ENRICHMENT_PRICING_VALID_UNTIL?.trim();
  if (input === null || output === null || !validUntil) return null;
  return {
    inputEuroPerMillionTokens: input,
    outputEuroPerMillionTokens: output,
    validUntil,
  };
}

export async function generateTranscriptEnrichmentAdmin(transcriptId: string) {
  const { actorStudent } = await requireAdmin();
  if (process.env.ALLOW_AI_PROVIDER_CALLS !== "1") {
    return {
      status: "failed" as const,
      error: "AI-calls zijn veilig geblokkeerd. Zet ALLOW_AI_PROVIDER_CALLS=1 alleen tijdens de goedgekeurde pilot.",
    };
  }
  const pricing = getEnrichmentPricingFromEnvironment();
  if (!pricing) {
    return {
      status: "failed" as const,
      error: "Actuele enrichmentprijsconfiguratie ontbreekt.",
    };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("ai_video_transcripts")
    .select("id, status, transcript, weekly_update:weekly_updates(video_duration_seconds)")
    .eq("id", transcriptId)
    .maybeSingle();
  if (error || !data) {
    return { status: "failed" as const, error: error?.message ?? "Transcript niet gevonden." };
  }
  if (data.status !== "ready" || !Array.isArray(data.transcript)) {
    return { status: "failed" as const, error: "Het transcript is nog niet gereed." };
  }
  const relation = data.weekly_update as
    | { video_duration_seconds: number | null }
    | Array<{ video_duration_seconds: number | null }>
    | null;
  const durationSeconds = Array.isArray(relation)
    ? relation[0]?.video_duration_seconds
    : relation?.video_duration_seconds;
  if (!durationSeconds) {
    return { status: "failed" as const, error: "Videoduur ontbreekt." };
  }

  const config = getFeatureConfig("market_insight_enrichment");
  const context = {
    transcriptId,
    actorStudentId: actorStudent.id,
    model: config.model,
    promptVersion: TRANSCRIPT_ENRICHMENT_PROMPT_VERSION,
  };
  const logInteraction = async (input: {
    status: "success" | "error";
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostEuro?: number;
    failureCode?: string;
    retryable?: boolean;
  }) => {
    const { error: logError } = await db.from("ai_interactions").insert({
      actor_student_id: context.actorStudentId,
      transcript_id: context.transcriptId,
      feature: "market_insight_enrichment",
      model: context.model,
      prompt_version: context.promptVersion,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      estimated_cost_eur: input.estimatedCostEuro ?? null,
      status: input.status,
      failure_code: input.failureCode ?? null,
      failure_retryable: input.retryable ?? false,
      // Intentionally no transcript or provider error message in the log.
      error: input.status === "error" ? input.failureCode ?? "enrichment_failed" : null,
    });
    if (logError) throw new Error("AI-interactielog kon niet worden opgeslagen.");
  };

  const store: EnrichmentJobStore = {
    async claim(claimInput) {
      const { data: claimData, error: claimError } = await db
        .rpc("claim_video_enrichment", {
          p_transcript_id: claimInput.transcriptId,
          p_prompt_version: claimInput.promptVersion,
          p_model: claimInput.model,
        })
        .single();
      if (claimError || !claimData) throw new Error(claimError?.message ?? "Enrichmentclaim mislukt.");
      const claimRow = claimData as {
        enrichment_id: string;
        claimed: boolean;
        enrichment_status: string;
      };
      return {
        enrichmentId: claimRow.enrichment_id,
        claimed: claimRow.claimed,
        status: claimRow.enrichment_status,
      };
    },
    async monthSpendEuro() {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const { data: rows, error: spendError } = await db
        .from("ai_interactions")
        .select("estimated_cost_eur")
        .eq("feature", "market_insight_enrichment")
        .eq("status", "success")
        .gte("created_at", monthStart.toISOString());
      if (spendError) throw new Error("Maandkosten konden niet worden gecontroleerd.");
      return (rows ?? []).reduce(
        (total, row) => total + Number(row.estimated_cost_eur ?? 0),
        0
      );
    },
    async saveDraft(saveInput) {
      const { error: saveError } = await db
        .from("ai_video_enrichments")
        .update({
          status: "draft",
          summary: saveInput.output.summary,
          key_takeaways: saveInput.output.keyTakeaways,
          chapters: saveInput.output.chapters,
          generated_content: saveInput.output,
          input_tokens: saveInput.usage.inputTokens,
          output_tokens: saveInput.usage.outputTokens,
          estimated_cost_eur: saveInput.estimatedCostEuro,
          failure_code: null,
          failure_retryable: false,
        })
        .eq("id", saveInput.enrichmentId)
        .eq("status", "processing");
      if (saveError) throw new Error("Enrichmentconcept kon niet worden opgeslagen.");
      await logInteraction({
        status: "success",
        inputTokens: saveInput.usage.inputTokens,
        outputTokens: saveInput.usage.outputTokens,
        estimatedCostEuro: saveInput.estimatedCostEuro,
      });
    },
    async fail(failInput) {
      const { error: failError } = await db
        .from("ai_video_enrichments")
        .update({
          status: "failed",
          failure_code: failInput.failureCode,
          failure_retryable: failInput.retryable,
          input_tokens: failInput.usage?.inputTokens ?? null,
          output_tokens: failInput.usage?.outputTokens ?? null,
        })
        .eq("id", failInput.enrichmentId)
        .eq("status", "processing");
      if (failError) throw new Error("Enrichmentfout kon niet worden opgeslagen.");
      await logInteraction({
        status: "error",
        inputTokens: failInput.usage?.inputTokens,
        outputTokens: failInput.usage?.outputTokens,
        failureCode: failInput.failureCode,
        retryable: failInput.retryable,
      });
    },
  };

  return executeTranscriptEnrichment({
    transcriptId,
    transcript: data.transcript as TranscriptSegment[],
    durationSeconds,
    promptVersion: context.promptVersion,
    model: context.model,
    provider: new AnthropicTranscriptEnrichmentProvider(context.model),
    store,
    pricing,
  });
}
