import { DEFAULT_TRANSCRIPTION_COST_POLICY } from "./cost-policy";

export type BackfillTranscriptState = "pending" | "processing" | "ready" | "failed";
export type BackfillDisposition = "eligible" | "skipped" | "blocked";
export type BackfillReason =
  | "ready_for_dry_run"
  | "transcript_exists"
  | "transcription_in_progress"
  | "previous_failure"
  | "legacy_source_unavailable"
  | "video_missing"
  | "mux_processing"
  | "mux_errored"
  | "duration_missing";

export type BackfillCatalogItem = {
  internalId: string;
  title: string;
  videoProvider: "mux" | "vimeo" | "youtube";
  videoUrl?: string | null;
  durationSeconds?: number | null;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
  muxStatus?: "preparing" | "ready" | "errored" | null;
  transcriptStatus?: BackfillTranscriptState | null;
};

export type BackfillDryRunItem = {
  selectionKey: string;
  title: string;
  provider: BackfillCatalogItem["videoProvider"];
  disposition: BackfillDisposition;
  reason: BackfillReason;
  durationMinutes: number | null;
  estimatedProviderSteps: number;
  costUpperBoundEuro: number;
};

export type BackfillDryRunReport = {
  generatedAt: string;
  items: BackfillDryRunItem[];
  summary: {
    total: number;
    eligible: number;
    skipped: number;
    blocked: number;
    knownDurationMinutes: number;
    eligibleDurationMinutes: number;
    estimatedProviderSteps: number;
    costUpperBoundEuro: number;
    monthlyLimitEuro: number;
    maxSelectableItems: number;
  };
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function classifyBackfillItem(item: BackfillCatalogItem): {
  disposition: BackfillDisposition;
  reason: BackfillReason;
} {
  if (item.transcriptStatus === "ready") {
    return { disposition: "skipped", reason: "transcript_exists" };
  }
  if (item.transcriptStatus === "pending" || item.transcriptStatus === "processing") {
    return { disposition: "skipped", reason: "transcription_in_progress" };
  }
  if (item.transcriptStatus === "failed") {
    return { disposition: "blocked", reason: "previous_failure" };
  }
  if (item.videoProvider === "vimeo" || item.videoProvider === "youtube") {
    return { disposition: "blocked", reason: "legacy_source_unavailable" };
  }
  if (!item.muxAssetId || !item.muxPlaybackId) {
    return { disposition: "blocked", reason: "video_missing" };
  }
  if (item.muxStatus === "preparing") {
    return { disposition: "skipped", reason: "mux_processing" };
  }
  if (item.muxStatus === "errored") {
    return { disposition: "blocked", reason: "mux_errored" };
  }
  if (!item.durationSeconds || item.durationSeconds <= 0) {
    return { disposition: "blocked", reason: "duration_missing" };
  }
  if (item.muxStatus !== "ready") {
    return { disposition: "blocked", reason: "video_missing" };
  }
  return { disposition: "eligible", reason: "ready_for_dry_run" };
}

export function buildBackfillDryRunReport(
  catalog: BackfillCatalogItem[],
  options: {
    selectionKey: (item: BackfillCatalogItem, index: number) => string;
    now?: Date;
  }
): BackfillDryRunReport {
  const items = catalog.map((item, index): BackfillDryRunItem => {
    const decision = classifyBackfillItem(item);
    const eligible = decision.disposition === "eligible";
    return {
      selectionKey: options.selectionKey(item, index),
      title: item.title.trim() || `Video ${index + 1}`,
      provider: item.videoProvider,
      ...decision,
      durationMinutes: item.durationSeconds && item.durationSeconds > 0
        ? round(item.durationSeconds / 60, 1)
        : null,
      estimatedProviderSteps: eligible ? 2 : 0,
      costUpperBoundEuro: eligible
        ? DEFAULT_TRANSCRIPTION_COST_POLICY.maxEuroPerVideo
        : 0,
    };
  });
  const count = (disposition: BackfillDisposition) =>
    items.filter((item) => item.disposition === disposition).length;
  const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));
  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    items,
    summary: {
      total: items.length,
      eligible: count("eligible"),
      skipped: count("skipped"),
      blocked: count("blocked"),
      knownDurationMinutes: sum(items.map((item) => item.durationMinutes ?? 0)),
      eligibleDurationMinutes: sum(items
        .filter((item) => item.disposition === "eligible")
        .map((item) => item.durationMinutes ?? 0)),
      estimatedProviderSteps: sum(items.map((item) => item.estimatedProviderSteps)),
      costUpperBoundEuro: sum(items.map((item) => item.costUpperBoundEuro)),
      monthlyLimitEuro: DEFAULT_TRANSCRIPTION_COST_POLICY.maxEuroPerMonth,
      maxSelectableItems: 10,
    },
  };
}

export function validateBackfillSelection(
  report: BackfillDryRunReport,
  selectedKeys: string[]
): { ok: true; selectionKeys: string[] } | { ok: false; reason: string } {
  const unique = [...new Set(selectedKeys)];
  if (unique.length !== selectedKeys.length) {
    return { ok: false, reason: "De selectie bevat dubbele items." };
  }
  if (unique.length > report.summary.maxSelectableItems) {
    return { ok: false, reason: `Selecteer maximaal ${report.summary.maxSelectableItems} items.` };
  }
  const eligible = new Set(
    report.items
      .filter((item) => item.disposition === "eligible")
      .map((item) => item.selectionKey)
  );
  if (unique.some((key) => !eligible.has(key))) {
    return { ok: false, reason: "Alleen eligible items mogen worden geselecteerd." };
  }
  return { ok: true, selectionKeys: unique };
}
