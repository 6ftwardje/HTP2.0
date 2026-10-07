import assert from "node:assert/strict";
import test from "node:test";
import { canStartTranscript } from "../../lib/transcription/start-policy";
import type { VideoTranscriptSummary } from "../../lib/types";

const readyVideo = {
  video_provider: "mux" as const,
  mux_status: "ready" as const,
  mux_asset_id: "asset_synthetic",
  mux_playback_id: "playback_synthetic",
};

function transcript(overrides: Partial<VideoTranscriptSummary> = {}): VideoTranscriptSummary {
  return {
    id: "transcript_synthetic",
    weekly_update_id: 1,
    source_version: "asset_synthetic",
    source_language: "nl",
    provider: "mux",
    provider_track_id: null,
    status: "failed",
    attempt_count: 1,
    failure_code: "rate_limited",
    failure_retryable: true,
    started_at: null,
    ready_at: null,
    failed_at: null,
    created_at: "2026-09-23T00:00:00.000Z",
    updated_at: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}

test("allows a first manual start for a ready Mux video", () => {
  assert.deepEqual(canStartTranscript(readyVideo, null), { allowed: true, retry: false });
});

test("allows only retryable failures to restart", () => {
  assert.deepEqual(canStartTranscript(readyVideo, transcript()), { allowed: true, retry: true });
  assert.equal(canStartTranscript(readyVideo, transcript({ failure_retryable: false })).allowed, false);
});

test("prevents duplicate processing jobs", () => {
  assert.equal(canStartTranscript(readyVideo, transcript({ status: "processing" })).allowed, false);
});
