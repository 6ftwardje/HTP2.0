import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  projectCaptionStatus,
  unwrapMuxCaptionEvent,
} from "../../lib/transcription/mux-webhook";

const SECRET = "synthetic_webhook_secret";

function signedHeaders(body: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return new Headers({ "mux-signature": `t=${timestamp},v1=${signature}` });
}

test("verifies and normalizes a generated caption ready event", async () => {
  const body = JSON.stringify({
    id: "event_synthetic",
    type: "video.asset.track.ready",
    data: {
      id: "track_synthetic",
      asset_id: "asset_synthetic",
      type: "text",
      text_type: "subtitles",
      text_source: "generated_vod",
      language_code: "nl",
    },
  });
  const event = await unwrapMuxCaptionEvent(body, signedHeaders(body), SECRET);
  assert.deepEqual(event, {
    id: "event_synthetic",
    type: "video.asset.track.ready",
    assetId: "asset_synthetic",
    trackId: "track_synthetic",
    languageCode: "nl",
    errorCode: null,
  });
});

test("rejects an invalid signature", async () => {
  const body = JSON.stringify({ id: "event_synthetic", type: "video.asset.track.ready", data: {} });
  await assert.rejects(
    unwrapMuxCaptionEvent(body, new Headers({ "mux-signature": "t=1,v1=bad" }), SECRET)
  );
});

test("ignores unrelated track events after authenticating", async () => {
  const body = JSON.stringify({
    id: "event_audio",
    type: "video.asset.track.ready",
    data: { id: "audio_synthetic", asset_id: "asset_synthetic", type: "audio" },
  });
  assert.equal(await unwrapMuxCaptionEvent(body, signedHeaders(body), SECRET), null);
});

test("out-of-order errors cannot degrade a ready transcript", () => {
  assert.equal(projectCaptionStatus("ready", "video.asset.track.errored"), "ready");
  assert.equal(projectCaptionStatus("pending", "video.asset.track.ready"), "processing");
});
