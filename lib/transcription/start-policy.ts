import type { VideoTranscriptSummary, WeeklyUpdate } from "@/lib/types";

export type TranscriptStartDecision =
  | { allowed: true; retry: boolean }
  | { allowed: false; reason: string };

export function canStartTranscript(
  video: Pick<WeeklyUpdate, "video_provider" | "mux_status" | "mux_asset_id" | "mux_playback_id">,
  transcript: VideoTranscriptSummary | null
): TranscriptStartDecision {
  if (
    video.video_provider !== "mux" ||
    video.mux_status !== "ready" ||
    !video.mux_asset_id ||
    !video.mux_playback_id
  ) {
    return { allowed: false, reason: "De Mux-video moet volledig klaar zijn." };
  }
  if (!transcript) return { allowed: true, retry: false };
  if (transcript.status === "failed" && transcript.failure_retryable) {
    return { allowed: true, retry: true };
  }
  if (transcript.status === "failed") {
    return { allowed: false, reason: "Deze fout vereist eerst menselijke controle." };
  }
  return { allowed: false, reason: "Transcriptie is al gestart voor deze videoversie." };
}
