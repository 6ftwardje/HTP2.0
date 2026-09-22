import Mux from "@mux/mux-node";

export type MuxCaptionEvent = {
  id: string;
  type: "video.asset.track.ready" | "video.asset.track.errored";
  assetId: string;
  trackId: string;
  languageCode: string;
  errorCode: string | null;
};

type UnknownEvent = {
  id?: unknown;
  type?: unknown;
  data?: Record<string, unknown>;
};

export async function unwrapMuxCaptionEvent(
  rawBody: string,
  headers: Headers,
  secret: string
): Promise<MuxCaptionEvent | null> {
  const mux = new Mux({ webhookSecret: secret });
  const event = (await mux.webhooks.unwrap(
    rawBody,
    headers,
    secret
  )) as unknown as UnknownEvent;

  if (
    event.type !== "video.asset.track.ready" &&
    event.type !== "video.asset.track.errored"
  ) {
    return null;
  }

  const data = event.data ?? {};
  // Only project generated on-demand subtitle tracks. Audio/video and uploaded
  // subtitle events are unrelated and deliberately acknowledged without writes.
  if (
    data.type !== "text" ||
    data.text_type !== "subtitles" ||
    data.text_source !== "generated_vod"
  ) {
    return null;
  }

  if (
    typeof event.id !== "string" ||
    typeof data.asset_id !== "string" ||
    typeof data.id !== "string" ||
    typeof data.language_code !== "string"
  ) {
    throw new Error("Mux-captionevent mist verplichte identifiers.");
  }

  const providerError = data.error as { type?: unknown } | undefined;
  return {
    id: event.id,
    type: event.type,
    assetId: data.asset_id,
    trackId: data.id,
    languageCode: data.language_code,
    errorCode:
      typeof providerError?.type === "string" ? providerError.type.slice(0, 120) : null,
  };
}

export function projectCaptionStatus(
  currentStatus: "pending" | "processing" | "ready" | "failed",
  eventType: MuxCaptionEvent["type"]
) {
  if (currentStatus === "ready") return "ready" as const;
  return eventType === "video.asset.track.ready"
    ? ("processing" as const)
    : ("failed" as const);
}
