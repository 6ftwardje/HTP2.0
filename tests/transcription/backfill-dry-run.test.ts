import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBackfillDryRunReport,
  classifyBackfillItem,
  validateBackfillSelection,
  type BackfillCatalogItem,
} from "../../lib/transcription/backfill-dry-run";

const readyMux: BackfillCatalogItem = {
  internalId: "db-id-must-not-leak",
  title: "Synthetische marktvideo",
  videoProvider: "mux",
  durationSeconds: 1_800,
  muxAssetId: "synthetic-asset",
  muxPlaybackId: "synthetic-playback",
  muxStatus: "ready",
};

test("only a complete ready Mux item is eligible", () => {
  assert.deepEqual(classifyBackfillItem(readyMux), {
    disposition: "eligible",
    reason: "ready_for_dry_run",
  });
});

test("Vimeo and YouTube stay blocked without a download workaround", () => {
  for (const videoProvider of ["vimeo", "youtube"] as const) {
    assert.deepEqual(classifyBackfillItem({
      ...readyMux,
      videoProvider,
      muxAssetId: null,
      muxPlaybackId: null,
    }), {
      disposition: "blocked",
      reason: "legacy_source_unavailable",
    });
  }
});

test("missing video and failed transcript require human action", () => {
  assert.equal(classifyBackfillItem({
    ...readyMux,
    muxAssetId: null,
  }).reason, "video_missing");
  assert.deepEqual(classifyBackfillItem({
    ...readyMux,
    transcriptStatus: "failed",
  }), {
    disposition: "blocked",
    reason: "previous_failure",
  });
});

test("existing and running transcripts are skipped before provider checks", () => {
  assert.equal(classifyBackfillItem({
    ...readyMux,
    transcriptStatus: "ready",
  }).reason, "transcript_exists");
  for (const transcriptStatus of ["pending", "processing"] as const) {
    assert.deepEqual(classifyBackfillItem({
      ...readyMux,
      transcriptStatus,
    }), {
      disposition: "skipped",
      reason: "transcription_in_progress",
    });
  }
});

test("report aggregates duration, provider steps and a conservative cost ceiling", () => {
  const report = buildBackfillDryRunReport([
    readyMux,
    { ...readyMux, internalId: "existing", transcriptStatus: "ready" },
    { ...readyMux, internalId: "legacy", videoProvider: "vimeo" },
  ], {
    selectionKey: (_item, index) => `opaque-${index}`,
    now: new Date("2026-09-23T12:00:00Z"),
  });
  assert.deepEqual(report.summary, {
    total: 3,
    eligible: 1,
    skipped: 1,
    blocked: 1,
    knownDurationMinutes: 90,
    eligibleDurationMinutes: 30,
    estimatedProviderSteps: 2,
    costUpperBoundEuro: 2,
    monthlyLimitEuro: 50,
    maxSelectableItems: 10,
  });
  assert.equal(report.generatedAt, "2026-09-23T12:00:00.000Z");
  assert.equal(JSON.stringify(report).includes(readyMux.internalId), false);
});

test("selection starts empty and accepts only explicit eligible unique keys", () => {
  const report = buildBackfillDryRunReport([
    readyMux,
    { ...readyMux, internalId: "existing", transcriptStatus: "ready" },
  ], { selectionKey: (_item, index) => `opaque-${index}` });
  assert.deepEqual(validateBackfillSelection(report, []), {
    ok: true,
    selectionKeys: [],
  });
  assert.deepEqual(validateBackfillSelection(report, ["opaque-0"]), {
    ok: true,
    selectionKeys: ["opaque-0"],
  });
  assert.equal(validateBackfillSelection(report, ["opaque-1"]).ok, false);
  assert.equal(validateBackfillSelection(report, ["opaque-0", "opaque-0"]).ok, false);
});

test("pilot selection is capped at ten items", () => {
  const catalog = Array.from({ length: 11 }, (_, index) => ({
    ...readyMux,
    internalId: `synthetic-${index}`,
  }));
  const report = buildBackfillDryRunReport(catalog, {
    selectionKey: (_item, index) => `opaque-${index}`,
  });
  assert.equal(
    validateBackfillSelection(report, report.items.map((item) => item.selectionKey)).ok,
    false
  );
});
