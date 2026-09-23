import {
  validateTranscriptEnrichment,
  type TranscriptEnrichment,
} from "@/lib/transcription/enrichment";

export type ReviewableStatus = "draft" | "review";

export function validateReviewTransition(input: {
  currentStatus: string;
  content: unknown;
  durationSeconds: number;
  action: "save" | "publish" | "reject";
  confirmed?: boolean;
}):
  | { ok: true; content?: TranscriptEnrichment }
  | { ok: false; reason: string } {
  if (!(["draft", "review"] as string[]).includes(input.currentStatus)) {
    return {
      ok: false,
      reason: "Alleen een concept of reviewversie kan worden aangepast.",
    };
  }
  if (input.action === "reject") return { ok: true };
  if (input.action === "publish" && input.confirmed !== true) {
    return { ok: false, reason: "Bevestig publicatie expliciet." };
  }
  const validated = validateTranscriptEnrichment(input.content, input.durationSeconds);
  if (!validated.ok) return { ok: false, reason: validated.reason };
  return { ok: true, content: validated.value };
}
