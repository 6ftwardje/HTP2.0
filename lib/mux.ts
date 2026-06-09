type MuxPlaybackPolicy = "public" | "signed";

type MuxUpload = {
  id: string;
  url?: string;
  status?: string;
  asset_id?: string;
  error?: {
    type?: string;
    messages?: string[];
  };
};

type MuxAsset = {
  id: string;
  status?: "preparing" | "ready" | "errored";
  duration?: number;
  playback_ids?: Array<{
    id: string;
    policy: MuxPlaybackPolicy;
  }>;
  errors?: {
    type?: string;
    messages?: string[];
  };
};

type MuxResponse<T> = {
  data?: T;
  error?: {
    type?: string;
    messages?: string[];
  };
};

function getMuxAuthHeader(): string {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error("Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET");
  }

  return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
}

async function muxFetch<T>(
  path: string,
  init?: RequestInit
): Promise<MuxResponse<T>> {
  const res = await fetch(`https://api.mux.com${path}`, {
    ...init,
    headers: {
      Authorization: getMuxAuthHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as MuxResponse<T>;
  if (!res.ok) {
    const detail =
      json.error?.messages?.join(" ") ||
      json.error?.type ||
      `Mux request failed with status ${res.status}`;
    throw new Error(detail);
  }

  return json;
}

export async function createMuxDirectUpload({
  lessonId,
  passthrough,
  corsOrigin,
  playbackPolicy = "public",
}: {
  lessonId?: number;
  passthrough?: Record<string, unknown>;
  corsOrigin: string;
  playbackPolicy?: MuxPlaybackPolicy;
}): Promise<{ id: string; url: string }> {
  const passthroughPayload = passthrough ?? (lessonId ? { lessonId } : null);

  const response = await muxFetch<MuxUpload>("/video/v1/uploads", {
    method: "POST",
    body: JSON.stringify({
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policies: [playbackPolicy],
        ...(passthroughPayload
          ? { passthrough: JSON.stringify(passthroughPayload) }
          : {}),
      },
    }),
  });

  const upload = response.data;
  if (!upload?.id || !upload.url) {
    throw new Error("Mux did not return an upload URL.");
  }

  return { id: upload.id, url: upload.url };
}

export async function getMuxUpload(uploadId: string): Promise<MuxUpload> {
  const response = await muxFetch<MuxUpload>(`/video/v1/uploads/${uploadId}`);
  if (!response.data) throw new Error("Mux upload not found.");
  return response.data;
}

export async function getMuxAsset(assetId: string): Promise<MuxAsset> {
  const response = await muxFetch<MuxAsset>(`/video/v1/assets/${assetId}`);
  if (!response.data) throw new Error("Mux asset not found.");
  return response.data;
}

export function getMuxErrorMessage(
  error?: { type?: string; messages?: string[] } | null
): string | null {
  if (!error) return null;
  return error.messages?.join(" ") || error.type || null;
}

export function getMuxThumbnailUrl(playbackId: string | null): string | null {
  if (!playbackId) return null;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`;
}
