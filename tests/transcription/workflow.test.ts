import assert from "node:assert/strict";
import test from "node:test";
import {
  failureTransition,
  leaseIsAvailable,
  nextWorkflowStep,
  retryDelaySeconds,
} from "../../lib/transcription/workflow";

test("uses bounded exponential retry delays", () => {
  assert.equal(retryDelaySeconds(1), 60);
  assert.equal(retryDelaySeconds(2), 300);
  assert.equal(retryDelaySeconds(3), 1_800);
  assert.equal(retryDelaySeconds(9), 1_800);
});

test("retryable failures schedule a next attempt", () => {
  assert.deepEqual(
    failureTransition({
      attemptCount: 2,
      retryable: true,
      now: new Date("2026-09-23T10:00:00Z"),
    }),
    { status: "failed", nextAttemptAt: "2026-09-23T10:05:00.000Z" }
  );
});

test("permanent and exhausted failures enter dead letter", () => {
  assert.equal(failureTransition({ attemptCount: 1, retryable: false }).status, "dead_letter");
  assert.equal(failureTransition({ attemptCount: 4, retryable: true }).status, "dead_letter");
});

test("derives the next workflow step without a translation dependency", () => {
  assert.equal(nextWorkflowStep({ transcriptStatus: "processing", hasEnrichment: false }), "fetch_transcript");
  assert.equal(nextWorkflowStep({ transcriptStatus: "ready", hasEnrichment: false }), "enrich");
  assert.equal(nextWorkflowStep({ transcriptStatus: "ready", hasEnrichment: true, enrichmentStatus: "draft" }), "review");
  assert.equal(nextWorkflowStep({ transcriptStatus: "ready", hasEnrichment: true, enrichmentStatus: "published" }), "complete");
});

test("an active lease excludes a concurrent worker and an expired lease recovers", () => {
  const now = new Date("2026-09-23T10:00:00Z");
  assert.equal(leaseIsAvailable({
    status: "running",
    attemptCount: 1,
    leaseExpiresAt: "2026-09-23T10:05:00Z",
    now,
  }), false);
  assert.equal(leaseIsAvailable({
    status: "running",
    attemptCount: 1,
    leaseExpiresAt: "2026-09-23T09:59:59Z",
    now,
  }), true);
});

test("backoff and exhausted attempts cannot be claimed", () => {
  const now = new Date("2026-09-23T10:00:00Z");
  assert.equal(leaseIsAvailable({
    status: "failed",
    attemptCount: 2,
    nextAttemptAt: "2026-09-23T10:05:00Z",
    now,
  }), false);
  assert.equal(leaseIsAvailable({ status: "failed", attemptCount: 4, now }), false);
});
