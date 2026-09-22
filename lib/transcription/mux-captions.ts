import {
  TranscriptionProviderError,
  type CaptionProvider,
  type CaptionTrack,
} from "./contracts";

type FetchLike = typeof fetch;
type MuxTrackPayload = {
  data?: {
    id?: string;
    status?: string;
    language_code?: string;
    text_type?: string;
  } | Array<{
    id?: string;
    status?: string;
    language_code?: string;
    text_type?: string;
  }>;
  error?: { type?: string; messages?: string[] };
};

const SAFE_ID = /^[A-Za-z0-9_-]{3,128}$/;
const LANGUAGE_CODE = /^[a-z]{2}(?:-[A-Z]{2})?$/;

function assertId(label: string, value: string) {
  if (!SAFE_ID.test(value)) {
    throw new TranscriptionProviderError(`${label} is ongeldig.`, "invalid_request", false);
  }
}

function toTrack(payload: MuxTrackPayload): CaptionTrack {
  const track = Array.isArray(payload.data) ? payload.data[0] : payload.data;
  if (
    !track?.id ||
    !SAFE_ID.test(track.id) ||
    !["preparing", "ready", "errored"].includes(track.status ?? "") ||
    !track.language_code
  ) {
    throw new TranscriptionProviderError(
      "Mux gaf een ongeldige captionresponse terug.",
      "invalid_payload",
      false
    );
  }
  return {
    id: track.id,
    status: track.status as CaptionTrack["status"],
    languageCode: track.language_code,
    textType: "subtitles",
  };
}

function providerError(status: number, payload?: MuxTrackPayload) {
  const message = payload?.error?.messages?.join(" ") || "Mux-captionrequest mislukt.";
  if (status === 404) return new TranscriptionProviderError(message, "not_found", false, status);
  if (status === 429) return new TranscriptionProviderError(message, "rate_limited", true, status);
  if (status >= 500) {
    return new TranscriptionProviderError(message, "provider_unavailable", true, status);
  }
  return new TranscriptionProviderError(message, "invalid_request", false, status);
}

export class MuxCaptionProvider implements CaptionProvider {
  constructor(
    private readonly tokenId: string,
    private readonly tokenSecret: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 10_000
  ) {
    if (!tokenId || !tokenSecret) throw new Error("Mux-credentials ontbreken.");
  }

  private async request(
    url: string,
    init?: RequestInit,
    includeCredentials = true
  ): Promise<Response> {
    try {
      return await this.fetchImpl(url.startsWith("https://") ? url : `https://api.mux.com${url}`, {
        ...init,
        headers: {
          ...(includeCredentials
            ? { Authorization: `Basic ${Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString("base64")}` }
            : {}),
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
        signal: init?.signal ?? AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timeout = error instanceof Error && /abort|timeout/i.test(error.name + error.message);
      throw new TranscriptionProviderError(
        timeout ? "Mux-captionrequest timeout." : "Mux is niet bereikbaar.",
        timeout ? "timeout" : "provider_unavailable",
        true
      );
    }
  }

  async requestGeneratedCaptions(input: {
    assetId: string;
    audioTrackId: string;
    languageCode: string;
    name: string;
    passthrough: string;
  }): Promise<CaptionTrack> {
    assertId("Mux asset-id", input.assetId);
    assertId("Mux audiotrack-id", input.audioTrackId);
    if (!LANGUAGE_CODE.test(input.languageCode)) {
      throw new TranscriptionProviderError("Taalcode is ongeldig.", "invalid_request", false);
    }
    const response = await this.request(
      `/video/v1/assets/${input.assetId}/tracks/${input.audioTrackId}/generate-subtitles`,
      {
      method: "POST",
      body: JSON.stringify({
        generated_subtitles: [{
          language_code: input.languageCode,
          name: input.name.slice(0, 100),
          passthrough: input.passthrough.slice(0, 255),
        }],
      }),
      }
    );
    const payload = (await response.json().catch(() => ({}))) as MuxTrackPayload;
    if (!response.ok) throw providerError(response.status, payload);
    return toTrack(payload);
  }

  async getTrack(assetId: string, trackId: string): Promise<CaptionTrack> {
    assertId("Mux asset-id", assetId);
    assertId("Mux track-id", trackId);
    const response = await this.request(`/video/v1/assets/${assetId}/tracks/${trackId}`);
    const payload = (await response.json().catch(() => ({}))) as MuxTrackPayload;
    if (!response.ok) throw providerError(response.status, payload);
    return toTrack(payload);
  }

  async getWebVtt(
    playbackId: string,
    trackId: string,
    signedToken?: string
  ): Promise<string> {
    assertId("Mux playback-id", playbackId);
    assertId("Mux track-id", trackId);
    const token = signedToken ? `?token=${encodeURIComponent(signedToken)}` : "";
    const response = await this.request(
      `https://stream.mux.com/${playbackId}/text/${trackId}.vtt${token}`,
      { headers: { Accept: "text/vtt" } },
      false
    );
    if (!response.ok) throw providerError(response.status);
    const body = await response.text();
    if (!body.trimStart().startsWith("WEBVTT")) {
      throw new TranscriptionProviderError(
        "Mux gaf geen geldige WebVTT terug.",
        "invalid_payload",
        false
      );
    }
    return body;
  }
}
