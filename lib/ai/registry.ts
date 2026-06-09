/**
 * AI feature registry: de enige plek waar per feature het model, de knowledge-bestanden
 * en de cache-tabel staan. Wil je een feature goedkoper maken, wissel dan hier het model
 * (bv. claude-sonnet-4-6 naar een Haiku-model). Zie docs/ai/README.md.
 */

export type AiFeatureKey = "mentor_summary";

export type AiFeatureConfig = {
  key: AiFeatureKey;
  /** Anthropic model-id. Te overschrijven via ANTHROPIC_MODEL. */
  model: string;
  /** Paden relatief aan de knowledge/ root, in promptvolgorde geladen. */
  knowledgeFiles: string[];
  /** Supabase-tabel waarin de output gecachet wordt (additief, admin-only). */
  cacheTable: string;
  description: string;
};

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";

export const AI_FEATURES: Record<AiFeatureKey, AiFeatureConfig> = {
  mentor_summary: {
    key: "mentor_summary",
    model: DEFAULT_MODEL,
    knowledgeFiles: [
      "ai/global/system-rules.md",
      "ai/global/safety-disclaimer.md",
      "ai/global/forbidden-advice.md",
      "ai/global/coaching-style.md",
      "ai/mentor-copilot/call-prep-checklist.md",
      "ai/mentor-copilot/student-risk-signals.md",
    ],
    cacheTable: "ai_student_summaries",
    description: "Admin-samenvatting per student voor mentor-calls.",
  },
};

export function getFeatureConfig(key: AiFeatureKey): AiFeatureConfig {
  return AI_FEATURES[key];
}
