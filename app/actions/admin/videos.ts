"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import {
  createLessonAdmin,
  createModuleAdmin,
  deleteEmptyModuleAdmin,
  deleteLessonAdmin,
  getLessonForVideoAdmin,
  updateLessonContentAdmin,
  updateLessonVideoAdmin,
  updateModuleAdmin,
} from "@/lib/admin/videos";
import {
  createMuxDirectUpload,
  getMuxAsset,
  getMuxErrorMessage,
  getMuxThumbnailUrl,
  getMuxUpload,
} from "@/lib/mux";
import type { LessonType } from "@/lib/types";

type ActionResult<T extends object = object> = T & {
  success: boolean;
  error?: string;
};

const THUMBNAIL_BUCKET = "course-thumbnails";
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;
const THUMBNAIL_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

type ThumbnailTarget = "modules" | "lessons";

type ThumbnailUploadInput = {
  name?: string;
  type?: string;
  size?: number;
};

function parseLessonId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parsePositiveInteger(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text ? text : null;
}

function parseLessonType(value: unknown): LessonType | null {
  return value === "theorie" || value === "praktijk" ? value : null;
}

function asLineList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function validateThumbnailUpload(input: ThumbnailUploadInput): string | null {
  if (!input.size || input.size <= 0) {
    return "Choose a thumbnail image.";
  }
  if (input.size > MAX_THUMBNAIL_SIZE) {
    return "Thumbnail must be smaller than 5 MB.";
  }
  if (!input.type || !THUMBNAIL_MIME_EXTENSIONS[input.type]) {
    return "Thumbnail must be a JPG, PNG, WebP, or AVIF image.";
  }
  return null;
}

function parseThumbnailTarget(value: unknown): ThumbnailTarget | null {
  return value === "modules" || value === "lessons" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function readModuleInput(formData: FormData) {
  const title = asString(formData.get("title"));
  const slug = slugify(asString(formData.get("slug")) || title);
  const orderIndex = parsePositiveInteger(formData.get("order_index"));

  if (!title) return { error: "Title is required." as const };
  if (!slug) return { error: "Slug is required." as const };
  if (!orderIndex) return { error: "Order must be a positive number." as const };

  return {
    input: {
      title,
      slug,
      short_description: asNullableString(formData.get("short_description")),
      description: asNullableString(formData.get("description")),
      thumbnail_url: asNullableString(formData.get("thumbnail_url")),
      order_index: orderIndex,
      is_published: asBoolean(formData.get("is_published")),
    },
  };
}

function readLessonInput(formData: FormData) {
  const moduleId = parsePositiveInteger(formData.get("module_id"));
  const lessonType = parseLessonType(formData.get("type"));
  const title = asString(formData.get("title"));
  const slug = slugify(asString(formData.get("slug")) || title);
  const orderIndex = parsePositiveInteger(formData.get("order_index"));

  if (!moduleId) return { error: "Choose a module." as const };
  if (!lessonType) return { error: "Choose a lesson type." as const };
  if (!title) return { error: "Title is required." as const };
  if (!slug) return { error: "Slug is required." as const };
  if (!orderIndex) return { error: "Order must be a positive number." as const };

  return {
    input: {
      module_id: moduleId,
      type: lessonType,
      title,
      slug,
      description: asNullableString(formData.get("description")),
      takeaway: asNullableString(formData.get("takeaway")),
      action_items: asLineList(formData.get("action_items")),
      thumbnail_url: asNullableString(formData.get("thumbnail_url")),
      order_index: orderIndex,
      is_published: asBoolean(formData.get("is_published")),
    },
  };
}

function getCorsOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "*";
}

function revalidateVideoPaths(lessonSlug?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/videos");
  revalidatePath("/dashboard");
  revalidatePath("/modules");
  if (lessonSlug) revalidatePath(`/lessons/${lessonSlug}`);
}

export async function adminCreateMuxUpload(
  lessonIdRaw: unknown
): Promise<ActionResult<{ uploadId?: string; uploadUrl?: string }>> {
  const { actorStudent } = await requireAdmin();
  const lessonId = parseLessonId(lessonIdRaw);
  if (!lessonId) return { success: false, error: "Invalid lesson" };

  const lesson = await getLessonForVideoAdmin(lessonId);
  if (!lesson) return { success: false, error: "Lesson not found" };

  try {
    const upload = await createMuxDirectUpload({
      lessonId,
      corsOrigin: getCorsOrigin(),
      playbackPolicy: "public",
    });

    const { error } = await updateLessonVideoAdmin(lessonId, {
      video_provider: "mux",
      mux_upload_id: upload.id,
      mux_status: "preparing",
      mux_playback_policy: "public",
      mux_asset_id: null,
      mux_playback_id: null,
      mux_error_message: null,
    });

    if (error) return { success: false, error };

    logAdminAction("video.mux_upload_created", {
      actorStudentId: actorStudent.id,
      metadata: { lessonId, uploadId: upload.id },
    });

    revalidateVideoPaths(lesson.slug);
    return { success: true, uploadId: upload.id, uploadUrl: upload.url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create Mux upload",
    };
  }
}

export async function adminCreateThumbnailUpload(
  targetRaw: unknown,
  entityIdRaw: unknown,
  fileInput: ThumbnailUploadInput
): Promise<
  ActionResult<{ path?: string; token?: string; publicUrl?: string }>
> {
  const { actorStudent } = await requireAdmin();
  const target = parseThumbnailTarget(targetRaw);
  const entityId = parsePositiveInteger(entityIdRaw);
  if (!target || !entityId) {
    return { success: false, error: "Invalid thumbnail target." };
  }

  const validationError = validateThumbnailUpload(fileInput);
  if (validationError) return { success: false, error: validationError };

  const db = await createClient();
  const extension = THUMBNAIL_MIME_EXTENSIONS[fileInput.type ?? ""] ?? "jpg";
  const path = `${target}/${entityId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await db.storage
    .from(THUMBNAIL_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    const errorMessage = error?.message ?? "Could not create thumbnail upload.";
    return {
      success: false,
      error: errorMessage.toLowerCase().includes("row-level security")
        ? "Supabase Storage policy is missing for course-thumbnails. Apply the course thumbnail storage migration, then try again."
        : errorMessage,
    };
  }

  const publicUrl = db.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path).data.publicUrl;

  logAdminAction("content.thumbnail_upload_created", {
    actorStudentId: actorStudent.id,
    metadata: { target, entityId, path },
  });

  return {
    success: true,
    path: data.path,
    token: data.token,
    publicUrl,
  };
}

export async function adminUpdateModuleThumbnail(
  moduleIdRaw: unknown,
  thumbnailUrlRaw: unknown
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const moduleId = parsePositiveInteger(moduleIdRaw);
  if (!moduleId) return { success: false, error: "Invalid module." };

  const thumbnailUrl = asNullableString(thumbnailUrlRaw);
  if (!thumbnailUrl) return { success: false, error: "Thumbnail URL is required." };

  const db = await createClient();
  const { data, error } = await db
    .from("modules")
    .update({ thumbnail_url: thumbnailUrl })
    .eq("id", moduleId)
    .select("id, slug")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Module not found." };

  logAdminAction("content.module_thumbnail_updated", {
    actorStudentId: actorStudent.id,
    metadata: { moduleId },
  });

  revalidateVideoPaths();
  revalidatePath(`/modules/${data.slug}`);
  return { success: true };
}

export async function adminUpdateLessonThumbnail(
  lessonIdRaw: unknown,
  thumbnailUrlRaw: unknown
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const lessonId = parseLessonId(lessonIdRaw);
  if (!lessonId) return { success: false, error: "Invalid lesson." };

  const thumbnailUrl = asNullableString(thumbnailUrlRaw);
  if (!thumbnailUrl) return { success: false, error: "Thumbnail URL is required." };

  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .update({ thumbnail_url: thumbnailUrl })
    .eq("id", lessonId)
    .select("id, slug")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Lesson not found." };

  logAdminAction("content.lesson_thumbnail_updated", {
    actorStudentId: actorStudent.id,
    metadata: { lessonId },
  });

  revalidateVideoPaths(data.slug);
  return { success: true };
}

export async function adminCreateModule(
  formData: FormData
): Promise<ActionResult<{ moduleId?: number }>> {
  const { actorStudent } = await requireAdmin();
  const parsed = readModuleInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const { module, error } = await createModuleAdmin(parsed.input);
  if (error) return { success: false, error };

  logAdminAction("content.module_created", {
    actorStudentId: actorStudent.id,
    metadata: { moduleId: module?.id, title: parsed.input.title },
  });

  revalidateVideoPaths();
  return { success: true, moduleId: module?.id };
}

export async function adminUpdateModule(
  moduleIdRaw: unknown,
  formData: FormData
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const moduleId = parsePositiveInteger(moduleIdRaw);
  if (!moduleId) return { success: false, error: "Invalid module." };

  const parsed = readModuleInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const { error } = await updateModuleAdmin(moduleId, parsed.input);
  if (error) return { success: false, error };

  logAdminAction("content.module_updated", {
    actorStudentId: actorStudent.id,
    metadata: { moduleId, title: parsed.input.title },
  });

  revalidateVideoPaths();
  revalidatePath(`/modules/${parsed.input.slug}`);
  return { success: true };
}

export async function adminCreateLesson(
  formData: FormData
): Promise<ActionResult<{ lessonId?: number }>> {
  const { actorStudent } = await requireAdmin();
  const parsed = readLessonInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const { lesson, error } = await createLessonAdmin(parsed.input);
  if (error) return { success: false, error };

  logAdminAction("content.lesson_created", {
    actorStudentId: actorStudent.id,
    metadata: { lessonId: lesson?.id, moduleId: parsed.input.module_id },
  });

  revalidateVideoPaths(lesson?.slug);
  return { success: true, lessonId: lesson?.id };
}

export async function adminCreateLessonMuxUpload(
  formData: FormData
): Promise<ActionResult<{ lessonId?: number; uploadId?: string; uploadUrl?: string }>> {
  const { actorStudent } = await requireAdmin();
  const parsed = readLessonInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const { lesson, error } = await createLessonAdmin({
    ...parsed.input,
    video_provider: "mux",
    mux_status: "preparing",
    mux_playback_policy: "public",
  });
  if (error || !lesson) return { success: false, error: error ?? "Could not create lesson." };

  try {
    const upload = await createMuxDirectUpload({
      lessonId: lesson.id,
      corsOrigin: getCorsOrigin(),
      playbackPolicy: "public",
    });

    const updated = await updateLessonVideoAdmin(lesson.id, {
      mux_upload_id: upload.id,
      mux_status: "preparing",
      mux_error_message: null,
    });
    if (updated.error) return { success: false, error: updated.error };

    logAdminAction("content.lesson_created_with_mux_upload", {
      actorStudentId: actorStudent.id,
      metadata: {
        lessonId: lesson.id,
        moduleId: parsed.input.module_id,
        uploadId: upload.id,
      },
    });

    revalidateVideoPaths(lesson.slug);
    return {
      success: true,
      lessonId: lesson.id,
      uploadId: upload.id,
      uploadUrl: upload.url,
    };
  } catch (error) {
    await updateLessonVideoAdmin(lesson.id, {
      mux_status: "errored",
      mux_error_message:
        error instanceof Error ? error.message : "Could not create Mux upload.",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create Mux upload.",
    };
  }
}

export async function adminUpdateLesson(
  lessonIdRaw: unknown,
  formData: FormData
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const lessonId = parseLessonId(lessonIdRaw);
  if (!lessonId) return { success: false, error: "Invalid lesson." };

  const parsed = readLessonInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const { error } = await updateLessonContentAdmin(lessonId, parsed.input);
  if (error) return { success: false, error };

  logAdminAction("content.lesson_updated", {
    actorStudentId: actorStudent.id,
    metadata: { lessonId, moduleId: parsed.input.module_id },
  });

  revalidateVideoPaths(parsed.input.slug);
  return { success: true };
}

export async function adminDeleteLesson(
  lessonIdRaw: unknown
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const lessonId = parseLessonId(lessonIdRaw);
  if (!lessonId) return { success: false, error: "Invalid lesson." };

  const lesson = await getLessonForVideoAdmin(lessonId);
  if (!lesson) return { success: false, error: "Lesson not found." };

  const { error } = await deleteLessonAdmin(lessonId);
  if (error) return { success: false, error };

  logAdminAction("content.lesson_deleted", {
    actorStudentId: actorStudent.id,
    metadata: { lessonId, moduleId: lesson.module_id, title: lesson.title },
  });

  revalidateVideoPaths(lesson.slug);
  return { success: true };
}

export async function adminDeleteModule(
  moduleIdRaw: unknown
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const moduleId = parsePositiveInteger(moduleIdRaw);
  if (!moduleId) return { success: false, error: "Invalid module." };

  const { error } = await deleteEmptyModuleAdmin(moduleId);
  if (error) return { success: false, error };

  logAdminAction("content.module_deleted", {
    actorStudentId: actorStudent.id,
    metadata: { moduleId },
  });

  revalidateVideoPaths();
  return { success: true };
}

export async function adminSyncMuxUpload(
  lessonIdRaw: unknown,
  uploadIdRaw?: unknown
): Promise<ActionResult<{ status?: string }>> {
  const { actorStudent } = await requireAdmin();
  const lessonId = parseLessonId(lessonIdRaw);
  if (!lessonId) return { success: false, error: "Invalid lesson" };

  const lesson = await getLessonForVideoAdmin(lessonId);
  if (!lesson) return { success: false, error: "Lesson not found" };

  const uploadId =
    typeof uploadIdRaw === "string" && uploadIdRaw.trim()
      ? uploadIdRaw.trim()
      : lesson.mux_upload_id;

  if (!uploadId) {
    return { success: false, error: "This lesson has no Mux upload yet." };
  }

  try {
    const upload = await getMuxUpload(uploadId);
    const uploadError = getMuxErrorMessage(upload.error);

    if (uploadError) {
      const { error } = await updateLessonVideoAdmin(lessonId, {
        mux_upload_id: upload.id,
        mux_status: "errored",
        mux_error_message: uploadError,
      });
      if (error) return { success: false, error };
      revalidateVideoPaths(lesson.slug);
      return { success: true, status: "errored" };
    }

    if (!upload.asset_id) {
      const { error } = await updateLessonVideoAdmin(lessonId, {
        mux_upload_id: upload.id,
        mux_status: "preparing",
        mux_error_message: null,
      });
      if (error) return { success: false, error };
      revalidateVideoPaths(lesson.slug);
      return { success: true, status: upload.status ?? "preparing" };
    }

    const asset = await getMuxAsset(upload.asset_id);
    const playback =
      asset.playback_ids?.find((p) => p.policy === "public") ??
      asset.playback_ids?.[0] ??
      null;
    const assetError = getMuxErrorMessage(asset.errors);
    const muxStatus = asset.status === "ready" ? "ready" : asset.status === "errored" ? "errored" : "preparing";
    const playbackUrl = playback ? `https://stream.mux.com/${playback.id}.m3u8` : null;

    const { error } = await updateLessonVideoAdmin(lessonId, {
      video_provider: "mux",
      video_url: playbackUrl,
      video_duration_seconds:
        typeof asset.duration === "number" ? Math.round(asset.duration) : null,
      thumbnail_url: lesson.thumbnail_url ?? getMuxThumbnailUrl(playback?.id ?? null),
      mux_upload_id: upload.id,
      mux_asset_id: asset.id,
      mux_playback_id: playback?.id ?? null,
      mux_playback_policy: playback?.policy ?? "public",
      mux_status: muxStatus,
      mux_error_message:
        muxStatus === "errored"
          ? assetError ?? "Mux could not process this asset."
          : null,
    });

    if (error) return { success: false, error };

    logAdminAction("video.mux_upload_synced", {
      actorStudentId: actorStudent.id,
      metadata: {
        lessonId,
        uploadId: upload.id,
        assetId: asset.id,
        status: muxStatus,
      },
    });

    revalidateVideoPaths(lesson.slug);
    return { success: true, status: muxStatus };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not sync Mux upload",
    };
  }
}
