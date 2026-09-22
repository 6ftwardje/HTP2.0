import "server-only";

import { createPrivateKey, sign } from "node:crypto";
import type { MuxPlaybackTokens } from "@/lib/types";

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signingPrivateKey() {
  const value = process.env.MUX_SIGNING_PRIVATE_KEY?.trim();
  if (!value) throw new Error("Missing MUX_SIGNING_PRIVATE_KEY");

  const decoded = value.includes("BEGIN")
    ? value.replace(/\\n/g, "\n")
    : Buffer.from(value, "base64").toString("utf8");
  return createPrivateKey(decoded);
}

function signMuxToken({
  playbackId,
  audience,
  expiresAt,
}: {
  playbackId: string;
  audience: "v" | "t" | "s";
  expiresAt: number;
}) {
  const keyId = process.env.MUX_SIGNING_KEY_ID?.trim();
  if (!keyId) throw new Error("Missing MUX_SIGNING_KEY_ID");

  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid: keyId });
  const payload = base64UrlJson({
    sub: playbackId,
    aud: audience,
    exp: expiresAt,
    iat: Math.floor(Date.now() / 1000),
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsignedToken), signingPrivateKey())
    .toString("base64url");
  return `${unsignedToken}.${signature}`;
}

export function createMuxPlaybackTokens({
  playbackId,
  durationSeconds,
}: {
  playbackId: string;
  durationSeconds?: number | null;
}): MuxPlaybackTokens {
  if (!/^[A-Za-z0-9_-]+$/.test(playbackId)) {
    throw new Error("Invalid Mux playback ID");
  }

  const lifetime = Math.max(
    2 * 60 * 60,
    Math.ceil(durationSeconds ?? 0) + 30 * 60
  );
  const expiresAt = Math.floor(Date.now() / 1000) + lifetime;
  return {
    playback: signMuxToken({ playbackId, audience: "v", expiresAt }),
    thumbnail: signMuxToken({ playbackId, audience: "t", expiresAt }),
    storyboard: signMuxToken({ playbackId, audience: "s", expiresAt }),
  };
}

export function getMuxPlaybackTokens({
  playbackId,
  playbackPolicy,
  durationSeconds,
}: {
  playbackId?: string | null;
  playbackPolicy?: "public" | "signed";
  durationSeconds?: number | null;
}) {
  if (playbackPolicy !== "signed" || !playbackId) return null;
  try {
    return createMuxPlaybackTokens({ playbackId, durationSeconds });
  } catch (error) {
    console.error("Mux signed playback token", error);
    return null;
  }
}
