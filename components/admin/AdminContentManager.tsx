"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  adminCreateLesson,
  adminCreateLessonMuxUpload,
  adminCreateModule,
  adminCreateMuxUpload,
  adminCreateThumbnailUpload,
  adminDeleteLesson,
  adminDeleteModule,
  adminSyncMuxUpload,
  adminUpdateLesson,
  adminUpdateLessonThumbnail,
  adminUpdateModule,
  adminUpdateModuleThumbnail,
} from "@/app/actions/admin/videos";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  formatModuleOptionLabel,
  stripModulePrefix,
} from "@/lib/module-title";
import type { AdminLessonVideoRow, AdminModuleVideoBlock } from "@/lib/admin/videos";
import type { Module } from "@/lib/types";

type PanelState =
  | { type: "empty" }
  | { type: "create-module" }
  | { type: "create-lesson"; moduleId?: number }
  | { type: "edit-module"; module: Module }
  | { type: "edit-lesson"; lesson: AdminLessonVideoRow };

type ConfirmState =
  | { type: "delete-lesson"; lesson: AdminLessonVideoRow }
  | { type: "delete-module"; module: Module; lessonCount: number }
  | null;

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

function statusBadge(lesson: AdminLessonVideoRow) {
  if (lesson.video_provider !== "mux") {
    return <span className="cb-badge cb-badge-locked">Legacy</span>;
  }
  if (lesson.mux_status === "ready") {
    return <span className="cb-badge cb-badge-completed">Ready</span>;
  }
  if (lesson.mux_status === "errored") {
    return <span className="cb-badge cb-badge-locked">Error</span>;
  }
  if (lesson.mux_upload_id) {
    return <span className="cb-badge cb-badge-available">Processing</span>;
  }
  return <span className="cb-badge cb-badge-locked">No video</span>;
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

function ModuleFields({
  module,
  onThumbnailFileChange,
}: {
  module?: Module;
  onThumbnailFileChange: (file: File | null) => void;
}) {
  return (
    <div className="grid gap-3">
      <ThumbnailField
        title={module?.title ?? "Module thumbnail"}
        currentUrl={module?.thumbnail_url}
        label="Module thumbnail"
        onFileChange={onThumbnailFileChange}
      />
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Title</span>
        <input name="title" defaultValue={module?.title ?? ""} required className={fieldClass()} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Slug</span>
          <input name="slug" defaultValue={module?.slug ?? ""} placeholder="auto from title" className={fieldClass()} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Order</span>
          <input name="order_index" type="number" min="1" defaultValue={module?.order_index ?? ""} required className={fieldClass()} />
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Short description</span>
        <input name="short_description" defaultValue={module?.short_description ?? ""} className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Description</span>
        <textarea name="description" defaultValue={module?.description ?? ""} rows={4} className={fieldClass()} />
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
        <input name="is_published" type="checkbox" defaultChecked={module?.is_published ?? false} className="h-4 w-4" />
        <span className="text-sm font-semibold text-[var(--foreground)]">Published</span>
      </label>
    </div>
  );
}

function LessonFields({
  lesson,
  modules,
  defaultModuleId,
  onThumbnailFileChange,
}: {
  lesson?: AdminLessonVideoRow;
  modules: Module[];
  defaultModuleId?: number;
  onThumbnailFileChange: (file: File | null) => void;
}) {
  return (
    <div className="grid gap-3">
      <ThumbnailField
        title={lesson?.title ?? "Lesson thumbnail"}
        currentUrl={lesson?.thumbnail_url}
        label="Lesson thumbnail"
        onFileChange={onThumbnailFileChange}
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Module</span>
          <select name="module_id" defaultValue={lesson?.module_id ?? defaultModuleId ?? ""} required className={fieldClass()}>
            <option value="">Choose module</option>
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {formatModuleOptionLabel(module.order_index, module.title)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Order</span>
          <input name="order_index" type="number" min="1" defaultValue={lesson?.order_index ?? ""} required className={fieldClass()} />
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Title</span>
        <input name="title" defaultValue={lesson?.title ?? ""} required className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Slug</span>
        <input name="slug" defaultValue={lesson?.slug ?? ""} placeholder="auto from title" className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Description</span>
        <textarea name="description" defaultValue={lesson?.description ?? ""} rows={4} className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Lesson takeaway</span>
        <textarea name="takeaway" defaultValue={lesson?.takeaway ?? ""} rows={2} className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Lesson actions</span>
        <textarea
          name="action_items"
          defaultValue={(lesson?.action_items ?? []).join("\n")}
          rows={5}
          placeholder="One action per line"
          className={fieldClass()}
        />
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
        <input name="is_published" type="checkbox" defaultChecked={lesson?.is_published ?? false} className="h-4 w-4" />
        <span className="text-sm font-semibold text-[var(--foreground)]">Published</span>
      </label>
    </div>
  );
}

function ThumbnailField({
  title,
  currentUrl,
  label,
  onFileChange,
}: {
  title: string;
  currentUrl?: string | null;
  label: string;
  onFileChange: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(currentUrl ?? null);
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_86%,var(--card)_14%)]">
      <CourseThumbnail
        src={previewUrl}
        title={title}
        eyebrow="Thumbnail"
        className="aspect-[16/9] w-full"
      />
      <div className="grid gap-3 p-3">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{label} URL</span>
          <input
            name="thumbnail_url"
            defaultValue={currentUrl ?? ""}
            placeholder="https://..."
            className={fieldClass()}
            onChange={(event) => setPreviewUrl(event.currentTarget.value.trim() || null)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Upload image</span>
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
                setPreviewUrl(currentUrl ?? null);
                return;
              }
              const nextUrl = URL.createObjectURL(file);
              objectUrlRef.current = nextUrl;
              setPreviewUrl(nextUrl);
            }}
          />
        </label>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          JPG, PNG, WebP, or AVIF. Best crop: 16:9.
        </p>
      </div>
    </div>
  );
}

function UploadProgress({ progress }: { progress: number | null }) {
  if (progress === null) return null;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--border)_70%,transparent)]">
        <div className="h-full rounded-full bg-[var(--foreground)] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{progress}% uploaded</p>
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
      aria-labelledby="delete-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
            <Icon name="trash" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="delete-confirm-title"
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              {confirm.type === "delete-lesson"
                ? "Delete lesson?"
                : confirm.lessonCount > 0
                  ? "Module has lessons"
                  : "Delete module?"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {confirm.type === "delete-lesson"
                ? `This will delete "${confirm.lesson.title}" and remove progress rows for this lesson.`
                : confirm.lessonCount > 0
                  ? `Module "${stripModulePrefix(confirm.module.title, confirm.module.order_index)}" still contains ${confirm.lessonCount} lesson${confirm.lessonCount === 1 ? "" : "s"}. Delete or move those lessons first.`
                  : `This will permanently delete module "${stripModulePrefix(confirm.module.title, confirm.module.order_index)}".`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="cb-btn cb-btn-secondary justify-center text-sm"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
          {confirm.type === "delete-module" && confirm.lessonCount > 0 ? null : (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              onClick={onConfirm}
            >
              <Icon name="trash" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AdminContentManager({ blocks }: { blocks: AdminModuleVideoBlock[] }) {
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
  const [deletedLessonIds, setDeletedLessonIds] = useState<Set<number>>(
    () => new Set()
  );
  const [deletedModuleIds, setDeletedModuleIds] = useState<Set<number>>(
    () => new Set()
  );

  const visibleBlocks = useMemo(
    () =>
      blocks
        .filter((block) => !deletedModuleIds.has(block.module.id))
        .map((block) => ({
          module: block.module,
          lessons: block.lessons.filter(
            (lesson) => !deletedLessonIds.has(lesson.id)
          ),
        })),
    [blocks, deletedLessonIds, deletedModuleIds]
  );
  const modules = useMemo(
    () => visibleBlocks.map((block) => block.module),
    [visibleBlocks]
  );
  const lessons = useMemo(
    () => visibleBlocks.flatMap((block) => block.lessons),
    [visibleBlocks]
  );
  const selectedLesson =
    panel.type === "edit-lesson"
      ? lessons.find((lesson) => lesson.id === panel.lesson.id) ?? panel.lesson
      : null;
  const selectedModule =
    panel.type === "edit-module"
      ? modules.find((module) => module.id === panel.module.id) ?? panel.module
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

  async function uploadThumbnailForEntity({
    target,
    entityId,
    file,
  }: {
    target: "modules" | "lessons";
    entityId: number;
    file: File;
  }): Promise<boolean> {
    setMessage("Preparing thumbnail upload...");
    const signed = await adminCreateThumbnailUpload(target, entityId, {
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
    const updated =
      target === "modules"
        ? await adminUpdateModuleThumbnail(entityId, signed.publicUrl)
        : await adminUpdateLessonThumbnail(entityId, signed.publicUrl);

    if (!updated.success) {
      setError(updated.error ?? "Could not save thumbnail.");
      return false;
    }

    setThumbnailFile(null);
    return true;
  }

  function runModuleSave(formData: FormData, module?: Module) {
    resetFeedback();
    const selectedThumbnailFile = thumbnailFile;
    startTransition(async () => {
      const result: { success: boolean; error?: string; moduleId?: number } =
        module
          ? await adminUpdateModule(module.id, formData)
          : await adminCreateModule(formData);
      if (!result.success) {
        setError(result.error ?? "Could not save module.");
        return;
      }

      const moduleId = module?.id ?? result.moduleId;
      if (selectedThumbnailFile && moduleId) {
        const uploaded = await uploadThumbnailForEntity({
          target: "modules",
          entityId: moduleId,
          file: selectedThumbnailFile,
        });
        if (!uploaded) return;
      }

      setThumbnailFile(null);
      setPanel({ type: "empty" });
      refresh(module ? "Module saved." : "Module created.");
    });
  }

  function runLessonSave(formData: FormData, lesson?: AdminLessonVideoRow) {
    resetFeedback();
    const file = fileInputRef.current?.files?.[0] ?? null;
    const selectedThumbnailFile = thumbnailFile;

    startTransition(async () => {
      if (lesson) {
        const saved = await adminUpdateLesson(lesson.id, formData);
        if (!saved.success) {
          setError(saved.error ?? "Could not save lesson.");
          return;
        }

        if (selectedThumbnailFile) {
          const uploaded = await uploadThumbnailForEntity({
            target: "lessons",
            entityId: lesson.id,
            file: selectedThumbnailFile,
          });
          if (!uploaded) return;
        }

        if (file) {
          await uploadForExistingLesson(lesson.id, file);
          return;
        }

        setThumbnailFile(null);
        setPanel({ type: "empty" });
        refresh("Lesson saved.");
        return;
      }

      if (file) {
        setMessage("Creating lesson and upload...");
        setProgress(0);
        const created = await adminCreateLessonMuxUpload(formData);
        if (!created.success || !created.lessonId || !created.uploadId || !created.uploadUrl) {
          setProgress(null);
          setError(created.error ?? "Could not create lesson upload.");
          return;
        }
        try {
          if (selectedThumbnailFile) {
            const uploaded = await uploadThumbnailForEntity({
              target: "lessons",
              entityId: created.lessonId,
              file: selectedThumbnailFile,
            });
            if (!uploaded) {
              setProgress(null);
              return;
            }
          }
          setMessage("Uploading to Mux...");
          await putFileWithProgress(created.uploadUrl, file, setProgress);
          setMessage("Upload complete. Syncing status...");
          await adminSyncMuxUpload(created.lessonId, created.uploadId);
          setThumbnailFile(null);
          setPanel({ type: "empty" });
          setProgress(null);
          refresh("Lesson created. Mux is processing the video.");
        } catch (uploadError) {
          setProgress(null);
          setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
        }
        return;
      }

      const created = await adminCreateLesson(formData);
      if (!created.success) {
        setError(created.error ?? "Could not create lesson.");
        return;
      }
      if (selectedThumbnailFile && created.lessonId) {
        const uploaded = await uploadThumbnailForEntity({
          target: "lessons",
          entityId: created.lessonId,
          file: selectedThumbnailFile,
        });
        if (!uploaded) return;
      }
      setThumbnailFile(null);
      setPanel({ type: "empty" });
      refresh("Lesson created.");
    });
  }

  async function uploadForExistingLesson(lessonId: number, file: File) {
    setMessage("Creating Mux upload...");
    setProgress(0);
    const created = await adminCreateMuxUpload(lessonId);
    if (!created.success || !created.uploadId || !created.uploadUrl) {
      setProgress(null);
      setError(created.error ?? "Could not create Mux upload.");
      return;
    }

    try {
      setMessage("Uploading to Mux...");
      await putFileWithProgress(created.uploadUrl, file, setProgress);
      setMessage("Upload complete. Syncing status...");
      await adminSyncMuxUpload(lessonId, created.uploadId);
      setThumbnailFile(null);
      setPanel({ type: "empty" });
      setProgress(null);
      refresh("Video uploaded. Mux is processing it.");
    } catch (uploadError) {
      setProgress(null);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    }
  }

  function deleteLesson(lesson: AdminLessonVideoRow) {
    resetFeedback();
    startTransition(async () => {
      const result = await adminDeleteLesson(lesson.id);
      if (!result.success) {
        setError(result.error ?? "Could not delete lesson.");
        return;
      }
      setDeletedLessonIds((current) => {
        const next = new Set(current);
        next.add(lesson.id);
        return next;
      });
      if (panel.type === "edit-lesson" && panel.lesson.id === lesson.id) {
        setThumbnailFile(null);
        setPanel({ type: "empty" });
      }
      refresh("Lesson deleted.");
    });
  }

  function deleteModule(module: Module, lessonCount: number) {
    const moduleTitle = stripModulePrefix(module.title, module.order_index);
    if (lessonCount > 0) {
      setError(
        `Module "${moduleTitle}" still has lessons. Delete or move those lessons first.`
      );
      return;
    }
    resetFeedback();
    startTransition(async () => {
      const result = await adminDeleteModule(module.id);
      if (!result.success) {
        setError(result.error ?? "Could not delete module.");
        return;
      }
      setDeletedModuleIds((current) => {
        const next = new Set(current);
        next.add(module.id);
        return next;
      });
      if (panel.type === "edit-module" && panel.module.id === module.id) {
        setThumbnailFile(null);
        setPanel({ type: "empty" });
      }
      refresh("Module deleted.");
    });
  }

  function syncLesson(lesson: AdminLessonVideoRow) {
    resetFeedback();
    startTransition(async () => {
      const result = await adminSyncMuxUpload(lesson.id);
      if (!result.success) {
        setError(result.error ?? "Could not sync Mux status.");
        return;
      }
      refresh(result.status === "ready" ? "Video is ready." : "Mux status updated.");
    });
  }

  const panelTitle =
    panel.type === "create-module"
      ? "New module"
      : panel.type === "create-lesson"
        ? "New lesson"
        : panel.type === "edit-module"
          ? "Edit module"
          : panel.type === "edit-lesson"
            ? "Edit lesson"
            : "Select an item";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="cb-eyebrow">Overview</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              Modules and lessons
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cb-btn cb-btn-secondary text-sm"
              onClick={() => {
                resetPanel({ type: "create-module" });
              }}
            >
              <Icon name="plus" /> Module
            </button>
            <button
              type="button"
              className="cb-btn cb-btn-primary text-sm"
              disabled={modules.length === 0}
              onClick={() => {
                resetPanel({ type: "create-lesson" });
              }}
            >
              <Icon name="plus" /> Lesson
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {visibleBlocks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="cb-body">No modules yet. Create the first module to start building the curriculum.</p>
            </div>
          ) : (
            visibleBlocks.map(({ module, lessons: moduleLessons }) => {
              const moduleTitle = stripModulePrefix(
                module.title,
                module.order_index
              );

              return (
              <div key={module.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    className="grid min-w-0 gap-3 text-left sm:grid-cols-[104px_minmax(0,1fr)] sm:items-center"
                    onClick={() => {
                      resetPanel({ type: "edit-module", module });
                    }}
                  >
                    <CourseThumbnail
                      src={module.thumbnail_url}
                      title={moduleTitle}
                      eyebrow={`M${module.order_index}`}
                      className="aspect-[16/10] rounded-xl"
                      muted={!module.is_published}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
                          {moduleTitle}
                        </h3>
                        <span className={module.is_published ? "cb-badge cb-badge-available" : "cb-badge cb-badge-locked"}>
                          {module.is_published ? "Published" : "Draft"}
                        </span>
                      </div>
                      {module.short_description ? (
                        <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{module.short_description}</p>
                      ) : null}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className={iconButtonClass()}
                      aria-label={`Add lesson to ${moduleTitle}`}
                      title="Add lesson"
                      onClick={() => {
                        resetPanel({ type: "create-lesson", moduleId: module.id });
                      }}
                    >
                      <Icon name="plus" />
                    </button>
                    <button
                      type="button"
                      className={iconButtonClass()}
                      aria-label={`Edit ${moduleTitle}`}
                      title="Edit module"
                      onClick={() => {
                        resetPanel({ type: "edit-module", module });
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className={iconButtonClass("danger")}
                      aria-label={`Delete ${moduleTitle}`}
                      title={moduleLessons.length > 0 ? "Delete lessons first" : "Delete module"}
                      onClick={() => {
                        resetFeedback();
                        setConfirm({
                          type: "delete-module",
                          module,
                          lessonCount: moduleLessons.length,
                        });
                      }}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                  {moduleLessons.length === 0 ? (
                    <div className="bg-[color-mix(in_oklab,var(--background)_88%,var(--card)_12%)] px-4 py-3">
                      <p className="cb-caption">No lessons in this module yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {moduleLessons.map((lesson) => (
                        <div key={lesson.id} className="grid gap-3 bg-[color-mix(in_oklab,var(--background)_88%,var(--card)_12%)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <button
                            type="button"
                            className="grid min-w-0 gap-3 text-left sm:grid-cols-[76px_minmax(0,1fr)] sm:items-center"
                            onClick={() => {
                              resetPanel({ type: "edit-lesson", lesson });
                            }}
                          >
                            <CourseThumbnail
                              src={lesson.thumbnail_url}
                              title={lesson.title}
                              eyebrow={`${lesson.order_index}`}
                              className="aspect-[16/10] rounded-lg"
                              muted={!lesson.is_published}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                                  {lesson.title}
                                </span>
                                {statusBadge(lesson)}
                                <span className={lesson.is_published ? "cb-badge cb-badge-available" : "cb-badge cb-badge-locked"}>
                                  {lesson.is_published ? "Published" : "Draft"}
                                </span>
                              </div>
                              {lesson.description ? (
                                <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{lesson.description}</p>
                              ) : null}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 md:justify-end">
                            <button
                              type="button"
                              className={iconButtonClass()}
                              aria-label={`Edit ${lesson.title}`}
                              title="Edit lesson"
                              onClick={() => {
                                resetPanel({ type: "edit-lesson", lesson });
                              }}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              type="button"
                              className={iconButtonClass()}
                              aria-label={`Upload video for ${lesson.title}`}
                              title="Upload video"
                              onClick={() => {
                                resetPanel({ type: "edit-lesson", lesson });
                                window.setTimeout(() => fileInputRef.current?.focus(), 0);
                              }}
                            >
                              <Icon name="upload" />
                            </button>
                            <button
                              type="button"
                              className={iconButtonClass()}
                              aria-label={`Sync ${lesson.title}`}
                              title="Sync Mux status"
                              disabled={!lesson.mux_upload_id || pending}
                              onClick={() => syncLesson(lesson)}
                            >
                              <Icon name="refresh" />
                            </button>
                            <button
                              type="button"
                              className={iconButtonClass("danger")}
                              aria-label={`Delete ${lesson.title}`}
                              title="Delete lesson"
                              onClick={() => {
                                resetFeedback();
                                setConfirm({ type: "delete-lesson", lesson });
                              }}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })
          )}
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 lg:sticky lg:top-6">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <div className="cb-eyebrow">Details</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{panelTitle}</h2>
          </div>
          {panel.type !== "empty" ? (
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--card)_70%,var(--foreground)_6%)]"
              onClick={() => {
                resetPanel({ type: "empty" });
              }}
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="pt-4">
          {panel.type === "empty" ? (
            <p className="cb-body">
              Select a module or lesson from the overview, or create a new item with the actions above.
            </p>
          ) : panel.type === "create-module" ? (
            <form action={(formData) => runModuleSave(formData)} className="space-y-4">
              <ModuleFields onThumbnailFileChange={setThumbnailFile} />
              <button type="submit" disabled={pending} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending ? "Saving..." : "Create module"}
              </button>
            </form>
          ) : panel.type === "edit-module" && selectedModule ? (
            <form action={(formData) => runModuleSave(formData, selectedModule)} className="space-y-4">
              <ModuleFields module={selectedModule} onThumbnailFileChange={setThumbnailFile} />
              <button type="submit" disabled={pending} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending ? "Saving..." : "Save module"}
              </button>
            </form>
          ) : panel.type === "create-lesson" ? (
            <form action={(formData) => runLessonSave(formData)} className="space-y-4">
              <LessonFields modules={modules} defaultModuleId={panel.moduleId} onThumbnailFileChange={setThumbnailFile} />
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Video file</span>
                <input ref={fileInputRef} type="file" accept="video/*" disabled={pending || progress !== null} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]" />
              </label>
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Working..." : "Create lesson"}
              </button>
            </form>
          ) : panel.type === "edit-lesson" && selectedLesson ? (
            <form action={(formData) => runLessonSave(formData, selectedLesson)} className="space-y-4">
              <LessonFields lesson={selectedLesson} modules={modules} onThumbnailFileChange={setThumbnailFile} />
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="cb-eyebrow">Video</div>
                    <div className="mt-1">{statusBadge(selectedLesson)}</div>
                  </div>
                  {selectedLesson.mux_upload_id ? (
                    <button
                      type="button"
                      className="cb-btn cb-btn-secondary text-sm"
                      disabled={pending}
                      onClick={() => syncLesson(selectedLesson)}
                    >
                      <Icon name="refresh" /> Sync
                    </button>
                  ) : null}
                </div>
                {selectedLesson.mux_playback_id ? (
                  <p className="mt-3 break-all text-xs text-[var(--muted)]">
                    Playback ID: <span className="font-mono text-[var(--foreground)]">{selectedLesson.mux_playback_id}</span>
                  </p>
                ) : null}
                {selectedLesson.mux_error_message ? (
                  <p className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">{selectedLesson.mux_error_message}</p>
                ) : null}
                <label className="mt-3 block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Replace/upload video</span>
                  <input ref={fileInputRef} type="file" accept="video/*" disabled={pending || progress !== null} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]" />
                </label>
              </div>
              <UploadProgress progress={progress} />
              <button type="submit" disabled={pending || progress !== null} className="cb-btn cb-btn-primary w-full justify-center text-sm">
                {pending || progress !== null ? "Working..." : "Save lesson"}
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
            if (current.type === "delete-lesson") {
              deleteLesson(current.lesson);
            } else {
              deleteModule(current.module, current.lessonCount);
            }
          }}
        />
      ) : null}
    </div>
  );
}
