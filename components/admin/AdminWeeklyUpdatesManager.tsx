"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  adminCreateWeeklyUpdate,
  adminCreateWeeklyUpdateMuxUpload,
  adminCreateWeeklyUpdateThumbnailUpload,
  adminCreateWeeklyUpdateWithMuxUpload,
  adminDeleteWeeklyUpdate,
  adminSyncWeeklyUpdateMuxUpload,
  adminStartWeeklyUpdateTranscript,
  adminUpdateWeeklyUpdate,
  adminUpdateWeeklyUpdateThumbnail,
} from "@/app/actions/admin/weekly-updates";
import {
  adminRestartTranscriptWorkflow,
  adminRunTranscriptWorkflow,
  adminPublishEnrichment,
  adminRejectEnrichment,
  adminSaveEnrichmentReview,
} from "@/app/actions/admin/transcription-ai";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AdminWeeklyUpdateRow } from "@/lib/admin/weekly-updates";
import {
  getIsoWeekNumber,
  getMarketAnalysisTypeLabel,
  getMarketLabel,
  MARKET_ANALYSIS_TYPE_OPTIONS,
  MARKET_OPTIONS,
} from "@/lib/market-analysis";
import type {
  MarketAnalysisType,
  Student,
  VideoEnrichmentSummary,
  VideoTranscriptSummary,
  WeeklyUpdateAccessTier,
} from "@/lib/types";
import {
  getWeeklyUpdateAccessLabel,
  WEEKLY_UPDATE_ACCESS_OPTIONS,
} from "@/lib/weekly-update-access";

type MentorOption = Pick<Student, "id" | "name" | "email">;

type PanelState =
  | { type: "empty" }
  | { type: "create" }
  | { type: "edit"; update: AdminWeeklyUpdateRow };

type ConfirmState = { type: "delete"; update: AdminWeeklyUpdateRow } | null;

function fieldClass() {
  return "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border))]";
}

function iconButtonClass(tone: "normal" | "danger" = "normal") {
  return `inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
    tone === "danger"
      ? "border-red-500/20 text-red-700 hover:bg-red-500/10 dark:text-red-300"
      : "border-[var(--border)] text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--card)_70%,var(--foreground)_6%)] hover:text-[var(--foreground)]"
  } disabled:cursor-not-allowed disabled:opacity-40`;
}

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: "edit" | "trash" | "plus" | "upload" | "refresh";
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  };

  if (name === "edit") {
    return (
      <svg {...common}>
        <path d="m4 16.8-.7 3.9 3.9-.7L18.9 8.3 15.7 5.1 4 16.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m14.6 6.2 3.2 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M5 7h14M9 7V5h6v2m-8 0 .8 13h8.4L17 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "upload") {
    return (
      <svg {...common}>
        <path d="M12 16V4m0 0 4 4m-4-4-4 4M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 6v5h-5M4 18v-5h5M18.4 10A6.5 6.5 0 0 0 7 6.6L4 10m2 4a6.5 6.5 0 0 0 11.4 3.4L20 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function putFileWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed before Mux accepted the file."));
    xhr.send(file);
  });
}

function statusBadge(update: AdminWeeklyUpdateRow) {
  if (update.video_provider !== "mux") {
    return <span className="cb-badge cb-badge-locked">Legacy</span>;
  }
  if (update.mux_status === "ready") {
    return <span className="cb-badge cb-badge-completed">Ready</span>;
  }
  if (update.mux_status === "errored") {
    return <span className="cb-badge cb-badge-locked">Error</span>;
  }
  if (update.mux_upload_id) {
    return <span className="cb-badge cb-badge-available">Processing</span>;
  }
  return <span className="cb-badge cb-badge-locked">No video</span>;
}

function latestTranscript(update: AdminWeeklyUpdateRow): VideoTranscriptSummary | null {
  return [...(update.transcripts ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  )[0] ?? null;
}

function transcriptBadge(transcript: VideoTranscriptSummary | null) {
  if (!transcript) return <span className="cb-badge cb-badge-locked">Geen transcript</span>;
  if (transcript.status === "ready") {
    return <span className="cb-badge cb-badge-completed">Transcript klaar</span>;
  }
  if (transcript.status === "failed") {
    return <span className="cb-badge cb-badge-locked">Transcript mislukt</span>;
  }
  return <span className="cb-badge cb-badge-available">Transcript in verwerking</span>;
}

function latestEnrichment(
  transcript: VideoTranscriptSummary | null
): VideoEnrichmentSummary | null {
  return [...(transcript?.enrichments ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  )[0] ?? null;
}

function transcriptWorkflow(transcript: VideoTranscriptSummary | null) {
  return transcript?.workflows?.[0] ?? null;
}

function EnrichmentReviewPanel({
  update,
  onDone,
  onError,
}: {
  update: AdminWeeklyUpdateRow;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const transcript = latestTranscript(update);
  const enrichment = latestEnrichment(transcript);
  const [busy, startReviewTransition] = useTransition();
  const [summary, setSummary] = useState(enrichment?.summary ?? "");
  const [takeaways, setTakeaways] = useState(
    (enrichment?.key_takeaways ?? []).join("\n")
  );
  const [chapters, setChapters] = useState(
    (enrichment?.chapters ?? [])
      .map((chapter) =>
        `${Math.floor(chapter.seconds / 60)}:${String(chapter.seconds % 60).padStart(2, "0")} ${chapter.title}`
      )
      .join("\n")
  );

  if (!transcript || !enrichment) return null;

  const content = () => ({
    summary: summary.trim(),
    keyTakeaways: takeaways.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    chapters: chapters.split(/\r?\n/).flatMap((line) => {
      const match = line.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$/);
      if (!match) return [];
      return [{
        title: match[4].trim(),
        seconds: Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]),
      }];
    }),
  });
  const editable = enrichment.status === "draft" || enrichment.status === "review";

  const run = (action: "save" | "publish" | "reject") => {
    if (action === "publish" && !window.confirm("Publiceer deze gecontroleerde AI-inhoud voor studenten?")) return;
    if (action === "reject" && !window.confirm("Wijs dit AI-concept definitief af?")) return;
    startReviewTransition(async () => {
      const result = action === "save"
        ? await adminSaveEnrichmentReview(enrichment.id, update.id, content())
        : action === "publish"
          ? await adminPublishEnrichment(enrichment.id, update.id, content(), true)
          : await adminRejectEnrichment(enrichment.id, update.id);
      if (!result.success) {
        onError(result.error ?? "De AI-review kon niet worden opgeslagen.");
        return;
      }
      onDone(
        action === "publish"
          ? "AI-inhoud gepubliceerd."
          : action === "reject"
            ? "AI-concept afgewezen."
            : "AI-review opgeslagen."
      );
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="cb-eyebrow">AI-review</div>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            Status: {enrichment.status} · {enrichment.model}
          </p>
        </div>
        {enrichment.published_at ? (
          <span className="cb-badge cb-badge-completed">Gepubliceerd</span>
        ) : null}
      </div>

      <details className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
        <summary className="cursor-pointer text-sm font-semibold">Brontranscript vergelijken</summary>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto text-sm leading-6 text-[var(--muted)]">
          {(transcript.transcript ?? []).map((segment) => (
            <p key={segment.id}>
              <span className="mr-2 font-mono text-xs text-[var(--foreground)]">
                {Math.floor(segment.startSeconds / 60)}:{String(Math.floor(segment.startSeconds % 60)).padStart(2, "0")}
              </span>
              {segment.text}
            </p>
          ))}
        </div>
      </details>

      <label className="mt-3 block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Samenvatting</span>
        <textarea value={summary} onChange={(event) => setSummary(event.currentTarget.value)} disabled={!editable || busy} rows={4} className={fieldClass()} />
      </label>
      <label className="mt-3 block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Aandachtspunten</span>
        <textarea value={takeaways} onChange={(event) => setTakeaways(event.currentTarget.value)} disabled={!editable || busy} rows={4} className={fieldClass()} />
      </label>
      <label className="mt-3 block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Hoofdstukken</span>
        <textarea value={chapters} onChange={(event) => setChapters(event.currentTarget.value)} disabled={!editable || busy} rows={4} className={fieldClass()} placeholder="00:00 Inleiding" />
      </label>

      {editable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="cb-btn cb-btn-secondary text-sm" onClick={() => run("save")}>Review opslaan</button>
          <button type="button" disabled={busy} className="cb-btn cb-btn-primary text-sm" onClick={() => run("publish")}>Publiceren</button>
          <button type="button" disabled={busy} className="cb-btn cb-btn-secondary text-sm text-red-700 dark:text-red-300" onClick={() => run("reject")}>Afwijzen</button>
        </div>
      ) : null}
    </div>
  );
}

function accessLabel(value: WeeklyUpdateAccessTier) {
  return getWeeklyUpdateAccessLabel(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function UploadProgress({ progress }: { progress: number | null }) {
  if (progress === null) return null;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--border)_70%,transparent)]">
        <div
          className="h-full rounded-full bg-[var(--foreground)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
        {progress}% uploaded
      </p>
    </div>
  );
}

function ThumbnailField({
  update,
  onFileChange,
}: {
  update?: AdminWeeklyUpdateRow;
  onFileChange: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    update?.thumbnail_url ?? null
  );
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(update?.thumbnail_url ?? null);
  }, [update?.thumbnail_url]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_86%,var(--card)_14%)]">
      <CourseThumbnail
        src={previewUrl}
        title={update?.title ?? "Marktanalyse thumbnail"}
        eyebrow={getMarketAnalysisTypeLabel(update?.type ?? null)}
        className="aspect-[16/9] w-full"
      />
      <div className="grid gap-3 p-3">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Thumbnail URL
          </span>
          <input
            name="thumbnail_url"
            defaultValue={update?.thumbnail_url ?? ""}
            placeholder="https://..."
            className={fieldClass()}
            onChange={(event) =>
              setPreviewUrl(event.currentTarget.value.trim() || null)
            }
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Upload image
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              onFileChange(file);
              if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
              }
              if (!file) {
                setPreviewUrl(update?.thumbnail_url ?? null);
                return;
              }
              const nextUrl = URL.createObjectURL(file);
              objectUrlRef.current = nextUrl;
              setPreviewUrl(nextUrl);
            }}
          />
        </label>
      </div>
    </div>
  );
}

function WeeklyUpdateFields({
  update,
  mentors,
  onThumbnailFileChange,
}: {
  update?: AdminWeeklyUpdateRow;
  mentors: MentorOption[];
  onThumbnailFileChange: (file: File | null) => void;
}) {
  const [analysisType, setAnalysisType] = useState<MarketAnalysisType | "">(
    update?.type ?? ""
  );

  useEffect(() => {
    setAnalysisType(update?.type ?? "");
  }, [update?.id, update?.type]);

  return (
    <div className="grid gap-3">
      <ThumbnailField update={update} onFileChange={onThumbnailFileChange} />
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Format <span className="text-red-600">*</span>
        </span>
        <select
          name="type"
          value={analysisType}
          required
          className={fieldClass()}
          onChange={(event) =>
            setAnalysisType(event.currentTarget.value as MarketAnalysisType | "")
          }
        >
          <option value="" disabled>Kies format</option>
          {MARKET_ANALYSIS_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <span className="block text-xs leading-5 text-[var(--muted)]">
          Kies Weekvooruitblik of Marktbreakdown. Live marktsessies plan je in het livebeheer.
        </span>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Markten {analysisType === "market_update" ? <span className="text-red-600">*</span> : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {[...MARKET_OPTIONS, { value: "macro" as const, label: "Macro" }].map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <input name="markets" type="checkbox" value={option.value} defaultChecked={update?.markets?.includes(option.value) || update?.market === option.value} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {analysisType === "market_update" ? (
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Event of aanleiding
          </span>
          <input name="event_context" defaultValue={update?.event_context ?? ""} placeholder="Bijv. rentebesluit ECB" className={fieldClass()} />
        </label>
      ) : <input type="hidden" name="event_context" value={update?.event_context ?? ""} />}
      <input type="hidden" name="market" value={update?.market ?? ""} />
      {analysisType === "weekly_outlook" ? (
        <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_72%,var(--background)_28%)] px-3 py-2.5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Week & publicatie</div>
          <p className="mt-1 text-sm text-[var(--foreground)]">
            {update?.week_start_date
              ? `Week ${getIsoWeekNumber(update.week_start_date)} · ${formatDate(update.week_start_date)}`
              : "Weeknummer en maandagdatum worden automatisch gekoppeld."}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">De publicatiedatum wordt vastgelegd bij publiceren.</p>
          <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Week of periode</span><input name="period_label" defaultValue={update?.period_label ?? ""} placeholder="Bijv. Week 39" className={fieldClass()} /></label>
        </div>
      ) : <input type="hidden" name="period_label" value={update?.period_label ?? ""} />}
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Titel
        </span>
        <input name="title" defaultValue={update?.title ?? ""} required className={fieldClass()} />
      </label>
      <div className="grid gap-3">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Slug
          </span>
          <input name="slug" defaultValue={update?.slug ?? ""} placeholder="auto from title" className={fieldClass()} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Host
          </span>
          <select name="mentor_student_id" defaultValue={update?.mentor_student_id ?? ""} className={fieldClass()}>
            <option value="">No mentor</option>
            {mentors.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>
                {mentor.name ?? mentor.email}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Access
          </span>
          <select name="access_tier" defaultValue={update?.access_tier ?? "subscription"} className={fieldClass()}>
            {WEEKLY_UPDATE_ACCESS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={!option.selectable}
              >
                {option.label}
              </option>
            ))}
          </select>
          <span className="block text-xs leading-5 text-[var(--muted)]">
            Marktupdates en Weekly Outlook-replays horen altijd bij de subscription.
          </span>
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Korte omschrijving / samenvatting
        </span>
        <textarea name="summary" defaultValue={update?.summary ?? ""} rows={4} className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Actualiteitsstatus</span>
        <select name="actuality_status" defaultValue={update?.actuality_status ?? "current"} className={fieldClass()}>
          <option value="current">Actueel</option><option value="still_relevant">Nog relevant</option><option value="archive">Archief</option>
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Belangrijke scenario&apos;s of aandachtspunten
        </span>
        <textarea
          name="key_takeaways"
          defaultValue={(update?.key_takeaways ?? []).join("\n")}
          rows={5}
          placeholder="One takeaway per line"
          className={fieldClass()}
        />
      </label>
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Hoofdstukken / timestamps</span><textarea name="chapters" defaultValue={(update?.chapters ?? []).map((chapter) => `${Math.floor(chapter.seconds / 60)}:${String(chapter.seconds % 60).padStart(2, "0")} ${chapter.title}`).join("\n")} rows={4} placeholder="00:00 Introductie" className={fieldClass()} /></label>
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Gerelateerde content</span><textarea name="related_content" defaultValue={(update?.related_content ?? []).map((item) => `${item.label} | ${item.href}`).join("\n")} rows={3} placeholder="Les risicobeheer | /lessons/risicobeheer" className={fieldClass()} /></label>
      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
        <input name="is_published" type="checkbox" defaultChecked={update?.is_published ?? false} className="h-4 w-4" />
        <span className="text-sm font-semibold text-[var(--foreground)]">Published</span>
      </label>
    </div>
  );
}

function DeleteConfirmModal({
  confirm,
  pending,
  onCancel,
  onConfirm,
}: {
  confirm: NonNullable<ConfirmState>;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-market-analysis-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
        <h2 id="delete-market-analysis-title" className="text-lg font-semibold text-[var(--foreground)]">
          Video verwijderen?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          <span className="font-semibold">{confirm.update.title}</span> en de bijbehorende kijkstatus worden verwijderd.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="cb-btn cb-btn-secondary justify-center text-sm" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
          >
            <Icon name="trash" />
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AdminWeeklyUpdatesManager({
  updates,
  mentors,
}: {
  updates: AdminWeeklyUpdateRow[];
  mentors: MentorOption[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [panel, setPanel] = useState<PanelState>({ type: "empty" });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [mounted, setMounted] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(() => new Set());
  const [archiveFilter, setArchiveFilter] = useState<"all" | "uncategorized">("all");

  const availableUpdates = useMemo(
    () => updates.filter((update) => !deletedIds.has(update.id)),
    [updates, deletedIds]
  );
  const uncategorizedCount = availableUpdates.filter((update) => update.needs_review || !update.type).length;
  const visibleUpdates = useMemo(
    () =>
      archiveFilter === "uncategorized"
        ? availableUpdates.filter((update) => update.needs_review || !update.type)
        : availableUpdates,
    [archiveFilter, availableUpdates]
  );
  const selectedUpdate =
    panel.type === "edit"
      ? visibleUpdates.find((update) => update.id === panel.update.id) ??
        panel.update
      : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!confirm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirm]);

  function resetFeedback() {
    setMessage(null);
    setError(null);
    setProgress(null);
  }

  function resetPanel(nextPanel: PanelState) {
    resetFeedback();
    setThumbnailFile(null);
    setPanel(nextPanel);
  }

  function refresh(messageText?: string) {
    if (messageText) setMessage(messageText);
    router.refresh();
  }

  async function uploadThumbnailForUpdate(
    weeklyUpdateId: number,
    file: File
  ): Promise<boolean> {
    setMessage("Preparing thumbnail upload...");
    const signed = await adminCreateWeeklyUpdateThumbnailUpload(weeklyUpdateId, {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!signed.success || !signed.path || !signed.token || !signed.publicUrl) {
      setError(signed.error ?? "Could not prepare thumbnail upload.");
      return false;
    }

    setMessage("Uploading thumbnail...");
    const supabase = createBrowserSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from("course-thumbnails")
      .uploadToSignedUrl(signed.path, signed.token, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      return false;
    }

    setMessage("Saving thumbnail...");
    const updated = await adminUpdateWeeklyUpdateThumbnail(
      weeklyUpdateId,
      signed.publicUrl
    );

    if (!updated.success) {
      setError(updated.error ?? "Could not save thumbnail.");
      return false;
    }

    setThumbnailFile(null);
    return true;
  }

  async function uploadForExistingUpdate(weeklyUpdateId: number, file: File) {
    setMessage("Creating Mux upload...");
    setProgress(0);
    const created = await adminCreateWeeklyUpdateMuxUpload(weeklyUpdateId);
    if (!created.success || !created.uploadId || !created.uploadUrl) {
      setProgress(null);
      setError(created.error ?? "Could not create Mux upload.");
      return;
    }

    if (panel.type === "edit" && panel.update.is_published) {
      setMessage(
        "De update is tijdelijk als concept gezet totdat de nieuwe video klaar is."
      );
    }

    try {
      setMessage("Uploading to Mux...");
      await putFileWithProgress(created.uploadUrl, file, setProgress);
      setMessage("Upload complete. Syncing status...");
      const synced = await adminSyncWeeklyUpdateMuxUpload(
        weeklyUpdateId,
        created.uploadId
      );
      if (!synced.success) {
        setProgress(null);
        setError(
          synced.error ??
            "Video uploaded, but Mux status could not be synced. Try Sync again."
        );
        setMessage("Video uploaded safely. Mux status still needs to be synced.");
        refresh();
        return;
      }
      setThumbnailFile(null);
      setProgress(null);
      refresh(
        synced.status === "ready"
          ? "De video is klaar."
          : "De video is geüpload. Mux verwerkt hem nog."
      );
    } catch (uploadError) {
      setProgress(null);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    }
  }

  function runSave(formData: FormData, update?: AdminWeeklyUpdateRow) {
    resetFeedback();
    const file = fileInputRef.current?.files?.[0] ?? null;
    const selectedThumbnailFile = thumbnailFile;

    startTransition(async () => {
      if (update) {
        const saved = await adminUpdateWeeklyUpdate(update.id, formData);
        if (!saved.success) {
          setError(saved.error ?? "De video kon niet worden opgeslagen.");
          return;
        }

        if (selectedThumbnailFile) {
          const uploaded = await uploadThumbnailForUpdate(
            update.id,
            selectedThumbnailFile
          );
          if (!uploaded) return;
        }

        if (file) {
          await uploadForExistingUpdate(update.id, file);
          return;
        }

        setThumbnailFile(null);
        setPanel({ type: "empty" });
        refresh("Video opgeslagen.");
        return;
      }

      if (file) {
        setMessage("Video-item en upload worden voorbereid...");
        setProgress(0);
        const created = await adminCreateWeeklyUpdateWithMuxUpload(formData);
        if (!created.success || !created.weeklyUpdateId || !created.uploadId || !created.uploadUrl) {
          setProgress(null);
          setError(created.error ?? "De video-upload kon niet worden voorbereid.");
          return;
        }
        try {
          if (selectedThumbnailFile) {
            const uploaded = await uploadThumbnailForUpdate(
              created.weeklyUpdateId,
              selectedThumbnailFile
            );
            if (!uploaded) {
              setProgress(null);
              return;
            }
          }
          setMessage("Uploading to Mux...");
          await putFileWithProgress(created.uploadUrl, file, setProgress);
          setMessage("Upload complete. Syncing status...");
          const synced = await adminSyncWeeklyUpdateMuxUpload(
            created.weeklyUpdateId,
            created.uploadId
          );
          if (!synced.success) {
            setProgress(null);
            setPanel({ type: "empty" });
            setError(
              synced.error ??
                "De video is opgeslagen en geüpload, maar de Mux-status kon niet worden gesynchroniseerd. Open de video en probeer Sync opnieuw."
            );
            setMessage(
              "De video is veilig opgeslagen. De Mux-status moet nog worden gesynchroniseerd."
            );
            refresh();
            return;
          }
          setThumbnailFile(null);
          setPanel({ type: "empty" });
          setProgress(null);
          refresh(
            synced.status === "ready"
              ? "Video toegevoegd en klaar voor gebruik."
              : "Video toegevoegd. Mux verwerkt hem nog."
          );
        } catch (uploadError) {
          setProgress(null);
          setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
        }
        return;
      }

      const created = await adminCreateWeeklyUpdate(formData);
      if (!created.success) {
        setError(created.error ?? "De video kon niet worden toegevoegd.");
        return;
      }
      if (selectedThumbnailFile && created.weeklyUpdateId) {
        const uploaded = await uploadThumbnailForUpdate(
          created.weeklyUpdateId,
          selectedThumbnailFile
        );
        if (!uploaded) return;
      }
      setThumbnailFile(null);
      setPanel({ type: "empty" });
      refresh("Video toegevoegd.");
    });
  }

  function syncUpdate(update: AdminWeeklyUpdateRow) {
    resetFeedback();
    startTransition(async () => {
      const result = await adminSyncWeeklyUpdateMuxUpload(update.id);
      if (!result.success) {
        setError(result.error ?? "Could not sync Mux status.");
        return;
      }
      if (result.status === "errored") {
        setError("Mux kon deze video niet verwerken. Upload het videobestand opnieuw.");
        refresh();
        return;
      }
      refresh(
        result.status === "ready"
          ? "Video is ready."
          : "Mux verwerkt de video nog. Probeer straks opnieuw te syncen."
      );
    });
  }

  function startTranscript(update: AdminWeeklyUpdateRow) {
    resetFeedback();
    const confirmed = window.confirm(
      "Dit start een externe Mux-captionverwerking voor deze video. De captionstap wordt momenteel door Mux zonder extra toeslag aangeboden, maar telt wel als providerwrite. Doorgaan?"
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await adminStartWeeklyUpdateTranscript(update.id, true);
      if (!result.success) {
        setError(result.error ?? "Transcriptie kon niet worden gestart.");
        return;
      }
      refresh("Transcriptie is gestart. Mux meldt de status via de beveiligde webhook.");
    });
  }

  function runTranscriptWorkflow(update: AdminWeeklyUpdateRow, restart = false) {
    resetFeedback();
    const transcript = latestTranscript(update);
    if (!transcript) return;
    const confirmed = window.confirm(
      restart
        ? "Herstart deze vastgelopen workflow? Dit kan een betaalde AI-call uitvoeren, met de ingestelde limiet van maximaal EUR 2 per video."
        : "Haal het transcript op en genereer een AI-concept? Dit kan een betaalde AI-call uitvoeren, met de ingestelde limiet van maximaal EUR 2 per video."
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = restart
        ? await adminRestartTranscriptWorkflow(transcript.id, update.id, true)
        : await adminRunTranscriptWorkflow(transcript.id, update.id, true);
      if (!result.success) {
        setError(result.error ?? "De AI-verwerking kon niet worden voortgezet.");
        refresh();
        return;
      }
      refresh(
        result.state === "completed"
          ? "De AI-verwerking is afgerond."
          : "Het AI-concept staat klaar voor menselijke review."
      );
    });
  }

  function deleteUpdate(update: AdminWeeklyUpdateRow) {
    resetFeedback();
    startTransition(async () => {
      const result = await adminDeleteWeeklyUpdate(update.id);
      if (!result.success) {
        setError(result.error ?? "De video kon niet worden verwijderd.");
        return;
      }
      setDeletedIds((current) => {
        const next = new Set(current);
        next.add(update.id);
        return next;
      });
      if (panel.type === "edit" && panel.update.id === update.id) {
        setThumbnailFile(null);
        setPanel({ type: "empty" });
      }
      refresh("Video verwijderd.");
    });
  }

  const panelTitle =
    panel.type === "create"
      ? "Nieuwe video"
      : panel.type === "edit"
        ? "Video bewerken"
        : "Selecteer een video";

  return (
    <div className="grid gap-5 lg:h-[calc(100dvh-10rem)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)] lg:overflow-hidden">
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="cb-eyebrow">Bibliotheek</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              Marktinzicht
            </h2>
          </div>
          <button
            type="button"
            className="cb-btn cb-btn-primary text-sm"
            onClick={() => resetPanel({ type: "create" })}
          >
            <Icon name="plus" /> Video toevoegen
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] px-4 py-2" role="tablist" aria-label="Filter beheer">
          <button
            type="button"
            role="tab"
            aria-selected={archiveFilter === "all"}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold ${archiveFilter === "all" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)]"}`}
            onClick={() => setArchiveFilter("all")}
          >
            Alle video’s ({availableUpdates.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={archiveFilter === "uncategorized"}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold ${archiveFilter === "uncategorized" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)]"}`}
            onClick={() => setArchiveFilter("uncategorized")}
          >
            Controle nodig ({uncategorizedCount})
          </button>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto overscroll-contain">
          {visibleUpdates.length === 0 ? (
            <div className="p-8 text-center">
              <p className="cb-body">
                {archiveFilter === "uncategorized"
                  ? "Geen video’s wachten op handmatige classificatie."
                  : "Nog geen marktinzichten. Voeg de eerste video toe."}
              </p>
            </div>
          ) : (
            visibleUpdates.map((update) => (
              <div
                key={update.id}
                className={`grid gap-3 p-4 transition md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${
                  panel.type === "edit" && panel.update.id === update.id
                    ? "bg-[var(--surface-hover)]"
                    : ""
                }`}
              >
                <button
                  type="button"
                  className="grid min-w-0 gap-3 text-left sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center"
                  onClick={() => resetPanel({ type: "edit", update })}
                >
                  <CourseThumbnail
                    src={update.thumbnail_url}
                    title={update.title}
                    eyebrow={update.type === "market_update" ? getMarketLabel(update.market) : getMarketAnalysisTypeLabel(update.type)}
                    className="aspect-[16/10] rounded-xl"
                    muted={!update.is_published}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
                        {update.title}
                      </h3>
                      {statusBadge(update)}
                      {transcriptBadge(latestTranscript(update))}
                      <span className={update.is_published ? "cb-badge cb-badge-available" : "cb-badge cb-badge-locked"}>
                        {update.is_published ? "Published" : "Draft"}
                      </span>
                      <span className="cb-badge cb-badge-locked">
                        {accessLabel(update.access_tier)}
                      </span>
                      <span className={update.type ? "cb-badge cb-badge-available" : "cb-badge cb-badge-locked"}>
                        {getMarketAnalysisTypeLabel(update.type)}
                      </span>
                      {update.needs_review ? <span className="cb-badge cb-badge-locked">Controle nodig</span> : null}
                      {update.type === "market_update" ? (
                        <span className="cb-badge cb-badge-available">{getMarketLabel(update.market)}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {update.type === "weekly_outlook"
                        ? `Week ${getIsoWeekNumber(update.week_start_date)} · ${formatDate(update.week_start_date)}`
                        : formatDate(update.published_at ?? update.created_at)}
                      {update.mentor ? ` · ${update.mentor.name ?? update.mentor.email}` : ""}
                    </p>
                    {update.summary ? (
                      <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">
                        {update.summary}
                      </p>
                    ) : null}
                  </div>
                </button>
                <div className="flex items-center gap-2 md:justify-end">
                  <button
                    type="button"
                    className={iconButtonClass()}
                    aria-label={`Edit ${update.title}`}
                    title="Video bewerken"
                    onClick={() => resetPanel({ type: "edit", update })}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass()}
                    aria-label={`Upload video for ${update.title}`}
                    title="Upload video"
                    onClick={() => {
                      resetPanel({ type: "edit", update });
                      window.setTimeout(() => fileInputRef.current?.focus(), 0);
                    }}
                  >
                    <Icon name="upload" />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass()}
                    aria-label={`Sync ${update.title}`}
                    title="Sync Mux status"
                    disabled={!update.mux_upload_id || pending}
                    onClick={() => syncUpdate(update)}
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass("danger")}
                    aria-label={`Delete ${update.title}`}
                    title="Video verwijderen"
                    onClick={() => {
                      resetFeedback();
                      setConfirm({ type: "delete", update });
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] lg:max-h-full">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] p-4">
          <div>
            <div className="cb-eyebrow">Details</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {panelTitle}
            </h2>
          </div>
          {panel.type !== "empty" ? (
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--card)_70%,var(--foreground)_6%)]"
              onClick={() => resetPanel({ type: "empty" })}
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {panel.type === "empty" ? (
            <p className="cb-body">
              Selecteer een video uit de bibliotheek of voeg een nieuwe marktanalyse toe.
            </p>
          ) : panel.type === "create" ? (
            <form action={(formData) => runSave(formData)} className="space-y-4">
              <WeeklyUpdateFields key="create" mentors={mentors} onThumbnailFileChange={setThumbnailFile} />
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Video file</span>
                <input ref={fileInputRef} type="file" accept="video/*" disabled={pending || progress !== null} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]" />
              </label>
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Bezig..." : "Video toevoegen"}
              </button>
            </form>
          ) : selectedUpdate ? (
            <form action={(formData) => runSave(formData, selectedUpdate)} className="space-y-4">
              <WeeklyUpdateFields key={selectedUpdate.id} update={selectedUpdate} mentors={mentors} onThumbnailFileChange={setThumbnailFile} />
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="cb-eyebrow">Video</div>
                    <div className="mt-1">{statusBadge(selectedUpdate)}</div>
                  </div>
                  {selectedUpdate.mux_upload_id ? (
                    <button
                      type="button"
                      className="cb-btn cb-btn-secondary text-sm"
                      disabled={pending}
                      onClick={() => syncUpdate(selectedUpdate)}
                    >
                      <Icon name="refresh" /> Sync
                    </button>
                  ) : null}
                </div>
                {selectedUpdate.mux_playback_id ? (
                  <p className="mt-3 break-all text-xs text-[var(--muted)]">
                    Playback ID: <span className="font-mono text-[var(--foreground)]">{selectedUpdate.mux_playback_id}</span>
                  </p>
                ) : null}
                {selectedUpdate.mux_error_message ? (
                  <p className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">{selectedUpdate.mux_error_message}</p>
                ) : null}
                <label className="mt-3 block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Replace/upload video</span>
                  <input ref={fileInputRef} type="file" accept="video/*" disabled={pending || progress !== null} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]" />
                </label>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="cb-eyebrow">AI-transcriptie</div>
                    <div className="mt-1">{transcriptBadge(latestTranscript(selectedUpdate))}</div>
                  </div>
                  {(() => {
                    const transcript = latestTranscript(selectedUpdate);
                    const workflow = transcriptWorkflow(transcript);
                    const canStart =
                      selectedUpdate.video_provider === "mux" &&
                      selectedUpdate.mux_status === "ready" &&
                      (!transcript ||
                        (transcript.status === "failed" && transcript.failure_retryable));
                    if (canStart) return (
                      <button
                        type="button"
                        className="cb-btn cb-btn-secondary text-sm"
                        disabled={pending}
                        onClick={() => startTranscript(selectedUpdate)}
                      >
                        {transcript ? "Opnieuw proberen" : "Transcriptie starten"}
                      </button>
                    );
                    const canProcess = transcript &&
                      ((transcript.status === "processing" && Boolean(transcript.provider_track_id)) ||
                        transcript.status === "ready") &&
                      !["waiting_review", "completed"].includes(workflow?.status ?? "");
                    if (!canProcess) return null;
                    const restart = workflow?.status === "dead_letter";
                    return (
                      <button
                        type="button"
                        className="cb-btn cb-btn-secondary text-sm"
                        disabled={pending}
                        onClick={() => runTranscriptWorkflow(selectedUpdate, restart)}
                      >
                        {restart ? "Workflow herstarten" : "AI-verwerking voortzetten"}
                      </button>
                    );
                  })()}
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  Handmatige pilot · Nederlands · menselijke review verplicht · geen automatische publicatie.
                </p>
                {latestTranscript(selectedUpdate)?.failure_code ? (
                  <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
                    Veilige foutcode: {latestTranscript(selectedUpdate)?.failure_code}
                  </p>
                ) : null}
                {transcriptWorkflow(latestTranscript(selectedUpdate))?.last_error_code ? (
                  <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
                    Workflowfout: {transcriptWorkflow(latestTranscript(selectedUpdate))?.last_error_code}
                  </p>
                ) : null}
              </div>
              <EnrichmentReviewPanel
                key={latestEnrichment(latestTranscript(selectedUpdate))?.id ?? "no-enrichment"}
                update={selectedUpdate}
                onDone={(text) => refresh(text)}
                onError={setError}
              />
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Bezig..." : "Video opslaan"}
              </button>
            </form>
          ) : null}

          {message ? <p className="mt-4 cb-caption">{message}</p> : null}
          {error ? (
            <p className="mt-4 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          ) : null}
        </div>
      </aside>

      {mounted && confirm ? (
        <DeleteConfirmModal
          confirm={confirm}
          pending={pending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const current = confirm;
            setConfirm(null);
            deleteUpdate(current.update);
          }}
        />
      ) : null}
    </div>
  );
}
