import type { TranscriptSegment } from "@/lib/transcription/contracts";
import {
  assessTranscriptQuality,
  validateNumericGrounding,
  validateTranscriptEnrichment,
  type TranscriptEnrichment,
} from "@/lib/transcription/enrichment";
import { evaluateCostGate, type TranscriptionCostPolicy } from "@/lib/transcription/cost-policy";

export type EnrichmentUsage = { inputTokens: number; outputTokens: number };
export type EnrichmentProviderResult = { output: unknown; usage: EnrichmentUsage };

export interface EnrichmentProvider {
  generate(input: {
    transcript: TranscriptSegment[];
    durationSeconds: number;
  }): Promise<EnrichmentProviderResult>;
}

export interface EnrichmentJobStore {
  claim(input: {
    transcriptId: string;
    promptVersion: string;
    model: string;
  }): Promise<{ enrichmentId: string; claimed: boolean; status: string }>;
  monthSpendEuro(): Promise<number>;
  saveDraft(input: {
    enrichmentId: string;
    output: TranscriptEnrichment;
    usage: EnrichmentUsage;
    estimatedCostEuro: number;
  }): Promise<void>;
  fail(input: {
    enrichmentId: string;
    failureCode: string;
    retryable: boolean;
    usage?: Partial<EnrichmentUsage>;
  }): Promise<void>;
}

export type EnrichmentPricing = {
  inputEuroPerMillionTokens: number;
  outputEuroPerMillionTokens: number;
  validUntil: string;
};

export function estimateEnrichmentCostEuro(
  inputTokens: number,
  outputTokens: number,
  pricing: EnrichmentPricing
) {
  return (
    (inputTokens * pricing.inputEuroPerMillionTokens +
      outputTokens * pricing.outputEuroPerMillionTokens) /
    1_000_000
  );
}

function pricingIsCurrent(pricing: EnrichmentPricing, now: Date) {
  const end = new Date(`${pricing.validUntil}T23:59:59.999Z`);
  return Number.isFinite(end.getTime()) && end >= now;
}

export async function executeTranscriptEnrichment(input: {
  transcriptId: string;
  transcript: TranscriptSegment[];
  durationSeconds: number;
  promptVersion: string;
  model: string;
  provider: EnrichmentProvider;
  store: EnrichmentJobStore;
  pricing: EnrichmentPricing;
  costPolicy?: TranscriptionCostPolicy;
  now?: Date;
}): Promise<
  | { status: "draft"; enrichmentId: string }
  | { status: "existing"; enrichmentId: string }
  | { status: "failed"; enrichmentId: string; error: string }
> {
  const quality = assessTranscriptQuality(input.transcript);
  const claim = await input.store.claim({
    transcriptId: input.transcriptId,
    promptVersion: input.promptVersion,
    model: input.model,
  });
  if (!claim.claimed) return { status: "existing", enrichmentId: claim.enrichmentId };

  if (!quality.usable) {
    await input.store.fail({
      enrichmentId: claim.enrichmentId,
      failureCode: `transcript_${quality.reason}`,
      retryable: false,
    });
    return { status: "failed", enrichmentId: claim.enrichmentId, error: "Transcriptkwaliteit onvoldoende." };
  }

  const transcriptText = input.transcript.map((segment) => segment.text).join(" ");
  const estimatedInputTokens = Math.ceil(transcriptText.length / 4);
  const estimatedCostEuro = estimateEnrichmentCostEuro(
    estimatedInputTokens,
    1_000,
    input.pricing
  );
  const costGate = evaluateCostGate(
    {
      estimatedEuro: estimatedCostEuro,
      monthSpendEuro: await input.store.monthSpendEuro(),
      priceConfigurationCurrent: pricingIsCurrent(input.pricing, input.now ?? new Date()),
    },
    input.costPolicy
  );
  if (!costGate.allowed) {
    await input.store.fail({
      enrichmentId: claim.enrichmentId,
      failureCode: "cost_gate_blocked",
      retryable: true,
    });
    return { status: "failed", enrichmentId: claim.enrichmentId, error: costGate.reason };
  }

  try {
    const generated = await input.provider.generate({
      transcript: input.transcript,
      durationSeconds: input.durationSeconds,
    });
    const validated = validateTranscriptEnrichment(generated.output, input.durationSeconds);
    if (!validated.ok) {
      await input.store.fail({
        enrichmentId: claim.enrichmentId,
        failureCode: "invalid_output",
        retryable: false,
        usage: generated.usage,
      });
      return { status: "failed", enrichmentId: claim.enrichmentId, error: validated.reason };
    }
    const grounding = validateNumericGrounding(validated.value, transcriptText);
    if (!grounding.ok) {
      await input.store.fail({
        enrichmentId: claim.enrichmentId,
        failureCode: "ungrounded_numeric_claim",
        retryable: false,
        usage: generated.usage,
      });
      return {
        status: "failed",
        enrichmentId: claim.enrichmentId,
        error: "De output bevat niet-onderbouwde cijfers.",
      };
    }
    await input.store.saveDraft({
      enrichmentId: claim.enrichmentId,
      output: validated.value,
      usage: generated.usage,
      estimatedCostEuro: estimateEnrichmentCostEuro(
        generated.usage.inputTokens,
        generated.usage.outputTokens,
        input.pricing
      ),
    });
    return { status: "draft", enrichmentId: claim.enrichmentId };
  } catch (error) {
    const providerError = error as { code?: string; retryable?: boolean };
    await input.store.fail({
      enrichmentId: claim.enrichmentId,
      failureCode: providerError.code ?? "provider_error",
      retryable: providerError.retryable === true,
    });
    return {
      status: "failed",
      enrichmentId: claim.enrichmentId,
      error: "De AI-provider kon geen concept genereren.",
    };
  }
}
