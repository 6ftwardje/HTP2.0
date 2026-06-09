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
  adminUpdateWeeklyUpdate,
  adminUpdateWeeklyUpdateThumbnail,
} from "@/app/actions/admin/weekly-updates";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AdminWeeklyUpdateRow } from "@/lib/admin/weekly-updates";
import type { Student } from "@/lib/types";

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
  }`;
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

function accessLabel(value: string) {
  if (value === "free") return "Free";
  if (value === "full_course") return "Full course";
  if (value === "mentor_membership") return "Mentorship";
  return "Premium";
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
        title={update?.title ?? "Weekly update thumbnail"}
        eyebrow="Weekly"
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
  return (
    <div className="grid gap-3">
      <ThumbnailField update={update} onFileChange={onThumbnailFileChange} />
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Title
        </span>
        <input name="title" defaultValue={update?.title ?? ""} required className={fieldClass()} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Slug
          </span>
          <input name="slug" defaultValue={update?.slug ?? ""} placeholder="auto from title" className={fieldClass()} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Week
          </span>
          <input name="week_start_date" type="date" defaultValue={update?.week_start_date ?? new Date().toISOString().slice(0, 10)} required className={fieldClass()} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Mentor
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
          <select name="access_tier" defaultValue={update?.access_tier ?? "full_course"} className={fieldClass()}>
            <option value="free">Free</option>
            <option value="full_course">Full course</option>
            <option value="premium">Premium</option>
            <option value="mentor_membership">Mentorship</option>
          </select>
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Market
        </span>
        <input name="market" defaultValue={update?.market ?? "Crypto"} className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Summary
        </span>
        <textarea name="summary" defaultValue={update?.summary ?? ""} rows={4} className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Key takeaways
        </span>
        <textarea
          name="key_takeaways"
          defaultValue={(update?.key_takeaways ?? []).join("\n")}
          rows={5}
          placeholder="One takeaway per line"
          className={fieldClass()}
        />
      </label>
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
      aria-labelledby="delete-weekly-update-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
        <h2 id="delete-weekly-update-title" className="text-lg font-semibold text-[var(--foreground)]">
          Delete weekly update?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          This will delete <span className="font-semibold">{confirm.update.title}</span> and remove its watch rows.
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

  const visibleUpdates = useMemo(
    () => updates.filter((update) => !deletedIds.has(update.id)),
    [updates, deletedIds]
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

    try {
      setMessage("Uploading to Mux...");
      await putFileWithProgress(created.uploadUrl, file, setProgress);
      setMessage("Upload complete. Syncing status...");
      await adminSyncWeeklyUpdateMuxUpload(weeklyUpdateId, created.uploadId);
      setThumbnailFile(null);
      setPanel({ type: "empty" });
      setProgress(null);
      refresh("Weekly update video uploaded. Mux is processing it.");
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
          setError(saved.error ?? "Could not save weekly update.");
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
        refresh("Weekly update saved.");
        return;
      }

      if (file) {
        setMessage("Creating weekly update and upload...");
        setProgress(0);
        const created = await adminCreateWeeklyUpdateWithMuxUpload(formData);
        if (!created.success || !created.weeklyUpdateId || !created.uploadId || !created.uploadUrl) {
          setProgress(null);
          setError(created.error ?? "Could not create weekly update upload.");
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
          await adminSyncWeeklyUpdateMuxUpload(
            created.weeklyUpdateId,
            created.uploadId
          );
          setThumbnailFile(null);
          setPanel({ type: "empty" });
          setProgress(null);
          refresh("Weekly update created. Mux is processing the video.");
        } catch (uploadError) {
          setProgress(null);
          setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
        }
        return;
      }

      const created = await adminCreateWeeklyUpdate(formData);
      if (!created.success) {
        setError(created.error ?? "Could not create weekly update.");
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
      refresh("Weekly update created.");
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
      refresh(result.status === "ready" ? "Video is ready." : "Mux status updated.");
    });
  }

  function deleteUpdate(update: AdminWeeklyUpdateRow) {
    resetFeedback();
    startTransition(async () => {
      const result = await adminDeleteWeeklyUpdate(update.id);
      if (!result.success) {
        setError(result.error ?? "Could not delete weekly update.");
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
      refresh("Weekly update deleted.");
    });
  }

  const panelTitle =
    panel.type === "create"
      ? "New weekly update"
      : panel.type === "edit"
        ? "Edit weekly update"
        : "Select an update";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="cb-eyebrow">Archive</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              Weekly updates
            </h2>
          </div>
          <button
            type="button"
            className="cb-btn cb-btn-primary text-sm"
            onClick={() => resetPanel({ type: "create" })}
          >
            <Icon name="plus" /> Weekly update
          </button>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {visibleUpdates.length === 0 ? (
            <div className="p-8 text-center">
              <p className="cb-body">
                No weekly updates yet. Create the first market analysis to start the archive.
              </p>
            </div>
          ) : (
            visibleUpdates.map((update) => (
              <div key={update.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <button
                  type="button"
                  className="grid min-w-0 gap-3 text-left sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center"
                  onClick={() => resetPanel({ type: "edit", update })}
                >
                  <CourseThumbnail
                    src={update.thumbnail_url}
                    title={update.title}
                    eyebrow={update.market ?? "Market"}
                    className="aspect-[16/10] rounded-xl"
                    muted={!update.is_published}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
                        {update.title}
                      </h3>
                      {statusBadge(update)}
                      <span className={update.is_published ? "cb-badge cb-badge-available" : "cb-badge cb-badge-locked"}>
                        {update.is_published ? "Published" : "Draft"}
                      </span>
                      <span className="cb-badge cb-badge-locked">
                        {accessLabel(update.access_tier)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Week van {formatDate(update.week_start_date)}
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
                    title="Edit weekly update"
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
                    title="Delete weekly update"
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

      <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 lg:sticky lg:top-6">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
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

        <div className="pt-4">
          {panel.type === "empty" ? (
            <p className="cb-body">
              Select an update from the archive, or create a new weekly market analysis.
            </p>
          ) : panel.type === "create" ? (
            <form action={(formData) => runSave(formData)} className="space-y-4">
              <WeeklyUpdateFields mentors={mentors} onThumbnailFileChange={setThumbnailFile} />
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Video file</span>
                <input ref={fileInputRef} type="file" accept="video/*" disabled={pending || progress !== null} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]" />
              </label>
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Working..." : "Create weekly update"}
              </button>
            </form>
          ) : selectedUpdate ? (
            <form action={(formData) => runSave(formData, selectedUpdate)} className="space-y-4">
              <WeeklyUpdateFields update={selectedUpdate} mentors={mentors} onThumbnailFileChange={setThumbnailFile} />
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
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Working..." : "Save weekly update"}
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
