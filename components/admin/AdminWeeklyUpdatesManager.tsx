"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  adminCreateWeeklyUpdate,
  adminCreateChartUpload,
  adminAttachChartImage,
  adminCreateWeeklyUpdateMuxUpload,
  adminCreateWeeklyUpdateThumbnailUpload,
  adminCreateWeeklyUpdateWithMuxUpload,
  adminDeleteWeeklyUpdate,
  adminRepairWeeklyUpdateNotification,
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
import { WeeklyUpdateFields, type MentorOption } from "@/components/admin/WeeklyUpdateFields";
import { LegacyBackfillDryRunPanel } from "@/components/admin/LegacyBackfillDryRunPanel";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AdminWeeklyUpdateRow } from "@/lib/admin/weekly-updates";
import { marketUpdateAuthorName } from "@/lib/market-update-author";
import {
  getIsoWeekNumber,
  getMarketAnalysisTypeLabel,
  getMarketLabel,
} from "@/lib/market-analysis";
import type {
  MarketAnalysisType,
  Student,
  VideoEnrichmentSummary,
  VideoTranscriptSummary,
  WeeklyUpdateAccessTier,
  WeeklyUpdateContentFormat,
} from "@/lib/types";
import { getWeeklyUpdateAccessLabel } from "@/lib/weekly-update-access";

type PanelState =
  | { type: "empty" }
  | { type: "create" }
  | { type: "edit"; update: AdminWeeklyUpdateRow };

function fieldClass() {
  return "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border))]";
}

type ConfirmState = { type: "delete"; update: AdminWeeklyUpdateRow } | null;

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
  if (update.content_format === "chart") return <span className="cb-badge cb-badge-available">Chart · {update.image_paths.length}/4</span>;
  if (update.content_format === "text") return <span className="cb-badge cb-badge-available">Tekst</span>;
  if (update.video_provider !== "mux") {
    return <span className="cb-badge cb-badge-locked">Oud formaat</span>;
  }
  if (update.mux_status === "ready") {
    return <span className="cb-badge cb-badge-completed">Klaar</span>;
  }
  if (update.mux_status === "errored") {
    return <span className="cb-badge cb-badge-locked">Fout</span>;
  }
  if (update.mux_upload_id) {
    return <span className="cb-badge cb-badge-available">In verwerking</span>;
  }
  return <span className="cb-badge cb-badge-locked">Geen video</span>;
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
  const workflows = transcript?.workflows;
  if (!workflows) return null;
  return Array.isArray(workflows) ? workflows[0] ?? null : workflows;
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

function accessLabel(value: WeeklyUpdateAccessTier, paidProductsActive: boolean) {
  return getWeeklyUpdateAccessLabel(value, paidProductsActive);
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
        {progress}% geüpload
      </p>
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
          Marktinzicht verwijderen?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          <span className="font-semibold">{confirm.update.title}</span> wordt definitief verwijderd en is daarna niet meer beschikbaar voor studenten.
          {confirm.update.content_format === "video" ? " Ook de bijbehorende kijkstatus wordt verwijderd." : null}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="cb-btn cb-btn-secondary justify-center text-sm" disabled={pending} onClick={onCancel}>
            Annuleren
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
          >
            <Icon name="trash" />
            Verwijderen
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
  initialUpdateId,
  paidProductsActive,
}: {
  updates: AdminWeeklyUpdateRow[];
  mentors: MentorOption[];
  initialUpdateId?: number | null;
  paidProductsActive: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chartFileRef = useRef<HTMLInputElement | null>(null);
  const hasUnsavedChanges = useRef(false);
  const initialUpdate = updates.find((update) => update.id === initialUpdateId);
  const [contentFormat, setContentFormat] = useState<WeeklyUpdateContentFormat>(
    initialUpdate?.content_format ?? "video"
  );
  const [panel, setPanel] = useState<PanelState>(
    initialUpdate ? { type: "edit", update: initialUpdate } : { type: "empty" }
  );
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
    const warnOnLeave = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmInternalNavigation = (event: MouseEvent) => {
      if (!hasUnsavedChanges.current || event.defaultPrevented || event.button !== 0) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (!window.confirm("Je hebt niet-opgeslagen wijzigingen. Wil je die verwerpen?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      hasUnsavedChanges.current = false;
    };
    window.addEventListener("beforeunload", warnOnLeave);
    window.addEventListener("click", confirmInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnOnLeave);
      window.removeEventListener("click", confirmInternalNavigation, true);
    };
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
    if (hasUnsavedChanges.current && !window.confirm("Je hebt niet-opgeslagen wijzigingen. Wil je die verwerpen?")) return;
    hasUnsavedChanges.current = false;
    resetFeedback();
    setThumbnailFile(null);
    setContentFormat(nextPanel.type === "edit" ? nextPanel.update.content_format : "video");
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
    setMessage("Thumbnailupload voorbereiden...");
    const signed = await adminCreateWeeklyUpdateThumbnailUpload(weeklyUpdateId, {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!signed.success || !signed.path || !signed.token || !signed.publicUrl) {
      setError(signed.error ?? "De thumbnailupload kon niet worden voorbereid.");
      return false;
    }

    setMessage("Thumbnail uploaden...");
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

    setMessage("Thumbnail opslaan...");
    const updated = await adminUpdateWeeklyUpdateThumbnail(
      weeklyUpdateId,
      signed.publicUrl
    );

    if (!updated.success) {
      setError(updated.error ?? "De thumbnail kon niet worden opgeslagen.");
      return false;
    }

    setThumbnailFile(null);
    return true;
  }

  async function uploadChartsForUpdate(id: number, files: File[]): Promise<boolean> {
    if (!files.length) return true;
    for (const file of files) {
      setMessage(`Chart uploaden: ${file.name}`);
      const signed = await adminCreateChartUpload(id, { type: file.type, size: file.size });
      if (!signed.success || !signed.path || !signed.token) { setError(signed.error ?? "Upload mislukt."); return false; }
      const { error: uploadError } = await createBrowserSupabaseClient().storage.from("market-update-charts").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
      if (uploadError) { setError(uploadError.message); return false; }
      const attached = await adminAttachChartImage(id, signed.path);
      if (!attached.success) { setError(attached.error ?? "Chart koppelen mislukt."); return false; }
    }
    return true;
  }

  async function uploadForExistingUpdate(weeklyUpdateId: number, file: File) {
    setMessage("Videoupload voorbereiden...");
    setProgress(0);
    const created = await adminCreateWeeklyUpdateMuxUpload(weeklyUpdateId);
    if (!created.success || !created.uploadId || !created.uploadUrl) {
      setProgress(null);
      setError(created.error ?? "De videoupload kon niet worden voorbereid.");
      return;
    }

    if (panel.type === "edit" && panel.update.is_published) {
      setMessage(
        "De update is tijdelijk als concept gezet totdat de nieuwe video klaar is."
      );
    }

    try {
      setMessage("Video uploaden...");
      await putFileWithProgress(created.uploadUrl, file, setProgress);
      setMessage("Upload voltooid. Videostatus bijwerken...");
      const synced = await adminSyncWeeklyUpdateMuxUpload(
        weeklyUpdateId,
        created.uploadId
      );
      if (!synced.success) {
        setProgress(null);
        setError(
          synced.error ??
            "De video is geüpload, maar de status kon niet worden bijgewerkt. Probeer het opnieuw."
        );
        setMessage("De video is opgeslagen. Werk de videostatus nog bij.");
        refresh();
        return;
      }
      setThumbnailFile(null);
      setProgress(null);
      hasUnsavedChanges.current = false;
      refresh(
        synced.status === "ready"
          ? "De video is klaar."
          : "De video is geüpload. Mux verwerkt hem nog."
      );
    } catch (uploadError) {
      setProgress(null);
      setError(uploadError instanceof Error ? uploadError.message : "De upload is mislukt.");
    }
  }

  function runSave(formData: FormData, update?: AdminWeeklyUpdateRow) {
    resetFeedback();
    const article = formData.get("content_kind") === "article";
    const file = article ? null : fileInputRef.current?.files?.[0] ?? null;
    const selectedThumbnailFile = thumbnailFile;
    const selectedChartFiles = Array.from(chartFileRef.current?.files ?? []);
    const selectedFormat = formData.get("content_format");
    if (selectedFormat === "chart" && selectedChartFiles.length + (update?.image_paths.length ?? 0) > 4) {
      setError("Maximaal vier chartafbeeldingen per update.");
      return;
    }

    startTransition(async () => {
      if (update) {
        const saved = await adminUpdateWeeklyUpdate(update.id, formData);
        if (!saved.success) {
          setError(saved.error ?? "De video kon niet worden opgeslagen.");
          return;
        }

        if (selectedFormat === "chart" && selectedChartFiles.length && !(await uploadChartsForUpdate(update.id, selectedChartFiles))) return;

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
        hasUnsavedChanges.current = false;
        setPanel({ type: "empty" });
        refresh("Marktupdate opgeslagen.");
        return;
      }

      if (selectedFormat !== "video") {
        const created = await adminCreateWeeklyUpdate(formData);
        if (!created.success || !created.weeklyUpdateId) { setError(created.error ?? "Concept maken mislukt."); return; }
        if (selectedFormat === "chart" && selectedChartFiles.length && !(await uploadChartsForUpdate(created.weeklyUpdateId, selectedChartFiles))) {
          hasUnsavedChanges.current = false;
          setPanel({ type: "empty" });
          refresh("Concept opgeslagen; open het opnieuw om de chartupload te hervatten.");
          return;
        }
        setPanel({ type: "empty" });
        hasUnsavedChanges.current = false;
        refresh("Concept opgeslagen. Open het opnieuw om te publiceren.");
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
          setMessage("Video uploaden...");
          await putFileWithProgress(created.uploadUrl, file, setProgress);
          setMessage("Upload voltooid. Videostatus bijwerken...");
          const synced = await adminSyncWeeklyUpdateMuxUpload(
            created.weeklyUpdateId,
            created.uploadId
          );
          if (!synced.success) {
            setProgress(null);
            hasUnsavedChanges.current = false;
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
          hasUnsavedChanges.current = false;
          setPanel({ type: "empty" });
          setProgress(null);
          refresh(
            synced.status === "ready"
              ? "Video toegevoegd en klaar voor gebruik."
              : "Video toegevoegd. Mux verwerkt hem nog."
          );
        } catch (uploadError) {
          setProgress(null);
          setError(uploadError instanceof Error ? uploadError.message : "De upload is mislukt.");
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
      hasUnsavedChanges.current = false;
      setPanel({ type: "empty" });
      refresh(article ? "Artikel toegevoegd." : "Video toegevoegd.");
    });
  }

  function syncUpdate(update: AdminWeeklyUpdateRow) {
    resetFeedback();
    startTransition(async () => {
      const result = await adminSyncWeeklyUpdateMuxUpload(update.id);
      if (!result.success) {
        setError(result.error ?? "De videostatus kon niet worden bijgewerkt.");
        return;
      }
      if (result.status === "errored") {
        setError("Mux kon deze video niet verwerken. Upload het videobestand opnieuw.");
        refresh();
        return;
      }
      refresh(
        result.status === "ready"
          ? "De video is klaar."
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
        setError(result.error ?? "De marktanalyse kon niet worden verwijderd.");
        return;
      }
      setDeletedIds((current) => {
        const next = new Set(current);
        next.add(update.id);
        return next;
      });
      if (panel.type === "edit" && panel.update.id === update.id) {
        setThumbnailFile(null);
        hasUnsavedChanges.current = false;
        setPanel({ type: "empty" });
      }
      refresh("Marktanalyse verwijderd.");
    });
  }

  const panelTitle =
    panel.type === "create"
      ? "Nieuw marktinzicht"
      : panel.type === "edit"
        ? "Marktinzicht bewerken"
        : "Selecteer een marktinzicht";

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
            <Icon name="plus" /> Marktinzicht toevoegen
          </button>
        </div>

        <LegacyBackfillDryRunPanel />

        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] px-4 py-2" role="tablist" aria-label="Filter beheer">
          <button
            type="button"
            role="tab"
            aria-selected={archiveFilter === "all"}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold ${archiveFilter === "all" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)]"}`}
            onClick={() => setArchiveFilter("all")}
          >
            Alle inzichten ({availableUpdates.length})
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
                  ? "Geen marktinzichten wachten op handmatige classificatie."
                  : "Nog geen marktinzichten. Voeg het eerste inzicht toe."}
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
                  {update.content_format === "chart" && update.image_paths.length > 0 ? <img src={`/api/market-updates/${update.id}/images/0`} alt="" className="aspect-[16/10] w-full rounded-xl object-contain" /> : update.content_format === "text" ? <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-[var(--surface-hover)] text-xs font-bold">Tekstupdate</div> : <CourseThumbnail
                    src={update.thumbnail_url}
                    title={update.title}
                    eyebrow={update.type === "market_update" ? getMarketLabel(update.market) : getMarketAnalysisTypeLabel(update.type)}
                    className="aspect-[16/10] rounded-xl"
                    muted={!update.is_published}
                  />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
                        {update.title}
                      </h3>
                      {statusBadge(update)}
                      {transcriptBadge(latestTranscript(update))}
                      <span className={update.is_published ? "cb-badge cb-badge-available" : "cb-badge cb-badge-locked"}>
                        {update.is_published ? "Gepubliceerd" : "Concept"}
                      </span>
                      <span className="cb-badge cb-badge-locked">
                        {accessLabel(update.access_tier, paidProductsActive)}
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
                      {update.content_format !== "video" && update.is_published
                        ? ` · Geplaatst door ${marketUpdateAuthorName(update)}`
                        : update.mentor ? ` · ${update.mentor.name ?? update.mentor.email}` : ""}
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
                    aria-label={`${update.title} bewerken`}
                    title="Marktinzicht bewerken"
                    onClick={() => resetPanel({ type: "edit", update })}
                  >
                    <Icon name="edit" />
                  </button>
                  {update.content_format === "video" ? (
                    <>
                      <button
                        type="button"
                        className={iconButtonClass()}
                        aria-label={`Video uploaden voor ${update.title}`}
                        title="Video uploaden"
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
                        aria-label={`Videostatus bijwerken voor ${update.title}`}
                        title="Videostatus bijwerken"
                        disabled={!update.mux_upload_id || pending}
                        onClick={() => syncUpdate(update)}
                      >
                        <Icon name="refresh" />
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={iconButtonClass("danger")}
                    aria-label={`${update.title} verwijderen`}
                    title="Marktinzicht verwijderen"
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
              Sluiten
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {panel.type === "empty" ? (
            <p className="cb-body">
              Selecteer een marktinzicht uit de bibliotheek of voeg een nieuw inzicht toe.
            </p>
          ) : panel.type === "create" ? (
            <form action={(formData) => runSave(formData)} onInput={() => { hasUnsavedChanges.current = true; }} onChange={() => { hasUnsavedChanges.current = true; }} className="space-y-4">
              <WeeklyUpdateFields key="create" mentors={mentors} paidProductsActive={paidProductsActive} onThumbnailFileChange={setThumbnailFile} onContentFormatChange={setContentFormat} chartFileRef={chartFileRef} />
              {contentFormat === "video" ? <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Videobestand</span>
                <input ref={fileInputRef} type="file" accept="video/*" disabled={pending || progress !== null} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]" />
              </label> : null}
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Bezig..." : contentFormat === "video" ? "Video toevoegen" : "Concept opslaan"}
              </button>
            </form>
          ) : selectedUpdate ? (
            <form action={(formData) => runSave(formData, selectedUpdate)} onInput={() => { hasUnsavedChanges.current = true; }} onChange={() => { hasUnsavedChanges.current = true; }} className="space-y-4">
              <WeeklyUpdateFields key={selectedUpdate.id} update={selectedUpdate} mentors={mentors} paidProductsActive={paidProductsActive} onThumbnailFileChange={setThumbnailFile} onContentFormatChange={setContentFormat} chartFileRef={chartFileRef} />
              {contentFormat === "video" ? <div className="rounded-xl border border-[var(--border)] p-3">
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
                      <Icon name="refresh" /> Status bijwerken
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
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Video vervangen of uploaden</span>
                  <input ref={fileInputRef} type="file" accept="video/*" disabled={pending || progress !== null} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]" />
                </label>
              </div> : null}
              {contentFormat === "video" ? <>
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
                <div className="mt-3" aria-live="polite">
                  {pending ? (
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Mux-captionverwerking wordt gestart…
                    </p>
                  ) : error ? (
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
                  ) : message ? (
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{message}</p>
                  ) : null}
                </div>
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
              </> : null}
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Bezig..." : "Marktupdate opslaan"}
              </button>
            </form>
          ) : null}

          {selectedUpdate?.is_published && selectedUpdate.access_tier === "subscription" ? (
            <button
              type="button"
              className="cb-btn cb-btn-secondary mt-4 w-full justify-center text-sm"
              disabled={pending}
              onClick={() => {
                resetFeedback();
                startTransition(async () => {
                  const result = await adminRepairWeeklyUpdateNotification(selectedUpdate.id);
                  if (result.success) {
                    setMessage(result.recipientCount
                      ? "Melding gecontroleerd; ontbrekende ontvangers zijn toegevoegd."
                      : "Geen huidige ontvangers voor dit inzicht.");
                  } else {
                    setError(result.error ?? "Melding controleren mislukt.");
                  }
                });
              }}
            >
              Melding controleren
            </button>
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
