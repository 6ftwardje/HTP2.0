import assert from "node:assert/strict";
import test from "node:test";
import { MuxCaptionProvider } from "../../lib/transcription/mux-captions";
import { TranscriptionProviderError } from "../../lib/transcription/contracts";

test("maps a synthetic ready Mux track without network", async () => {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    calls.push(String(input));
    return Response.json({
      data: { id: "track_synthetic", status: "ready", language_code: "nl", text_type: "subtitles" },
    });
  };
  const provider = new MuxCaptionProvider("token", "secret", fakeFetch);
  const track = await provider.getTrack("asset_synthetic", "track_synthetic");
  assert.equal(track.status, "ready");
  assert.equal(calls.length, 1);
});

test("normalizes a 429 as retryable", async () => {
  const fakeFetch: typeof fetch = async () =>
    Response.json({ error: { messages: ["Later opnieuw."] } }, { status: 429 });
  const provider = new MuxCaptionProvider("token", "secret", fakeFetch);
  await assert.rejects(
    provider.getTrack("asset_synthetic", "track_synthetic"),
    (error: unknown) =>
      error instanceof TranscriptionProviderError &&
      error.code === "rate_limited" &&
      error.retryable
  );
});

test("rejects unsafe identifiers before calling the provider", async () => {
  let called = false;
  const fakeFetch: typeof fetch = async () => {
    called = true;
    return Response.json({});
  };
  const provider = new MuxCaptionProvider("token", "secret", fakeFetch);
  await assert.rejects(provider.getTrack("../asset", "track_ok"), /ongeldig/);
  assert.equal(called, false);
});
