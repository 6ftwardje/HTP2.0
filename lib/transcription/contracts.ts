export const TRANSCRIPT_STATUSES = [
  "pending",
  "processing",
  "ready",
  "failed",
] as const;

export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];
export type ReviewStatus = "draft" | "review" | "published" | "rejected";

export type TranscriptSegment = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type CaptionTrack = {
  id: string;
  status: "preparing" | "ready" | "errored";
  languageCode: string;
  textType: "subtitles";
};

export type ProviderFailureCode =
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "provider_unavailable"
  | "invalid_payload";

export class TranscriptionProviderError extends Error {
  constructor(
    message: string,
    readonly code: ProviderFailureCode,
    readonly retryable: boolean,
    readonly status?: number
  ) {
    super(message);
    this.name = "TranscriptionProviderError";
  }
}

export interface CaptionProvider {
  requestGeneratedCaptions(input: {
    assetId: string;
    audioTrackId: string;
    languageCode: string;
    name: string;
    passthrough: string;
  }): Promise<CaptionTrack>;
  getTrack(assetId: string, trackId: string): Promise<CaptionTrack>;
  getWebVtt(playbackId: string, trackId: string, signedToken?: string): Promise<string>;
}
