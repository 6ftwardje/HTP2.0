"use client";

import { useState, useTransition } from "react";
import {
  adminPrepareLegacyBackfillSelection,
  adminPreviewLegacyBackfill,
} from "@/app/actions/admin/transcription-backfill";
import {
  validateBackfillSelection,
  type BackfillDryRunReport,
  type BackfillReason,
} from "@/lib/transcription/backfill-dry-run";

const REASON_LABELS: Record<BackfillReason, string> = {
  ready_for_dry_run: "Gereed voor selectie",
  transcript_exists: "Transcript bestaat al",
  transcription_in_progress: "Transcriptie loopt al",
  previous_failure: "Eerdere verwerking mislukt",
  legacy_source_unavailable: "Legacybron niet veilig beschikbaar",
  video_missing: "Videobron ontbreekt",
  mux_processing: "Mux verwerkt de video nog",
  mux_errored: "Mux-verwerking mislukt",
  duration_missing: "Videoduur ontbreekt",
};

function euro(value: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function LegacyBackfillDryRunPanel() {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<BackfillDryRunReport | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setSelected([]);
    setProposal(null);
    startTransition(async () => {
      const result = await adminPreviewLegacyBackfill();
      if (!result.success) {
        setReport(null);
        setError(result.error);
        return;
      }
      setReport(result.report);
    });
  };

  const toggle = (selectionKey: string) => {
    if (!report) return;
    const next = selected.includes(selectionKey)
      ? selected.filter((key) => key !== selectionKey)
      : [...selected, selectionKey];
    const validation = validateBackfillSelection(report, next);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setError(null);
    setProposal(null);
    setSelected(validation.selectionKeys);
  };

  const prepare = () => {
    if (!selected.length) return;
    if (!window.confirm("Bevestig deze selectie als read-only voorstel. Er wordt nog geen backfill gestart.")) return;
    setError(null);
    startTransition(async () => {
      const result = await adminPrepareLegacyBackfillSelection(selected, true);
      if (!result.success) {
        setProposal(null);
        setError(result.error);
        return;
      }
      setProposal(
        `Voorstel gecontroleerd: ${result.proposal.selected} video’s, ${result.proposal.durationMinutes} minuten, maximaal ${euro(result.proposal.costUpperBoundEuro)}. Geen verwerking gestart.`
      );
    });
  };

  return (
    <div className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_94%,var(--foreground)_2%)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="cb-eyebrow">Legacybackfill</div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Read-only inventarisatie; start geen verwerking of provider.
          </p>
        </div>
        <button
          type="button"
          className="cb-btn cb-btn-secondary text-sm"
          disabled={pending}
          onClick={run}
        >
          {pending ? "Inventariseren…" : report ? "Dry-run vernieuwen" : "Dry-run uitvoeren"}
        </button>
      </div>

      {report ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] p-2"><strong>{report.summary.eligible}</strong><br />eligible</div>
            <div className="rounded-lg border border-[var(--border)] p-2"><strong>{report.summary.skipped}</strong><br />overgeslagen</div>
            <div className="rounded-lg border border-[var(--border)] p-2"><strong>{report.summary.blocked}</strong><br />geblokkeerd</div>
            <div className="rounded-lg border border-[var(--border)] p-2"><strong>{euro(report.summary.costUpperBoundEuro)}</strong><br />kostenplafond</div>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {report.summary.eligibleDurationMinutes} eligible minuten · {report.summary.estimatedProviderSteps} geraamde providerstappen · maandlimiet {euro(report.summary.monthlyLimitEuro)}
          </p>
          <div className="max-h-56 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
            {report.items.map((item) => (
              <label key={item.selectionKey} className="flex items-start gap-3 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(item.selectionKey)}
                  disabled={item.disposition !== "eligible"}
                  onChange={() => toggle(item.selectionKey)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[var(--foreground)]">{item.title}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {item.provider.toUpperCase()} · {REASON_LABELS[item.reason]}
                    {item.durationMinutes !== null ? ` · ${item.durationMinutes} min` : ""}
                  </span>
                </span>
                <span className={`cb-badge ${
                  item.disposition === "eligible"
                    ? "cb-badge-completed"
                    : item.disposition === "skipped"
                      ? "cb-badge-available"
                      : "cb-badge-locked"
                }`}>
                  {item.disposition}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs font-semibold text-[var(--foreground)]">
            {selected.length} van maximaal {report.summary.maxSelectableItems} expliciet geselecteerd. Deze selectie blijft een voorstel en start niets.
          </p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary text-sm"
            disabled={pending || selected.length === 0}
            onClick={prepare}
          >
            Selectie read-only controleren
          </button>
          {proposal ? <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{proposal}</p> : null}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
