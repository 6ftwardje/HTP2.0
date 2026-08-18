"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import {
  createWeeklyUpdateAdmin,
  deleteWeeklyUpdateAdmin,
  getWeeklyUpdateAdmin,
  updateWeeklyUpdateAdmin,
  updateWeeklyUpdateVideoAdmin,
} from "@/lib/admin/weekly-updates";
import { notifyWeeklyUpdatePublished } from "@/lib/admin/weekly-update-notifications";
import {
  createMuxDirectUpload,
  getMuxAsset,
  getMuxErrorMessage,
  getMuxThumbnailUrl,
  getMuxUpload,
} from "@/lib/mux";
import { SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS } from "@/lib/weekly-update-access";
import { getMondayDate } from "@/lib/market-analysis";
import type {
  Market,
  MarketAnalysisType,
  WeeklyUpdateAccessTier,
} from "@/lib/types";

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
const ACCESS_TIERS: WeeklyUpdateAccessTier[] =
  SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS;
const MARKET_ANALYSIS_TYPES: Array<Exclude<MarketAnalysisType, "live_session">> = [
  "weekly_outlook",
  "market_update",
];
const MARKETS: Market[] = ["stocks", "forex", "crypto"];

type ThumbnailUploadInput = {
  name?: string;
  type?: string;
  size?: number;
};

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

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

function asLineList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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

function getCorsOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "*";
}

function revalidateWeeklyUpdatePaths(slug?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/weekly-updates");
  revalidatePath("/admin/market-analysis");
  revalidatePath("/dashboard");
  revalidatePath("/weekly-updates");
  revalidatePath("/market-analysis");
  if (slug) {
    revalidatePath(`/weekly-updates/${slug}`);
    revalidatePath(`/market-analysis/${slug}`);
  }
}

function validateThumbnailUpload(input: ThumbnailUploadInput): string | null {
  if (!input.size || input.size <= 0) return "Choose a thumbnail image.";
  if (input.size > MAX_THUMBNAIL_SIZE) {
    return "Thumbnail must be smaller than 5 MB.";
  }
  if (!input.type || !THUMBNAIL_MIME_EXTENSIONS[input.type]) {
    return "Thumbnail must be a JPG, PNG, WebP, or AVIF image.";
  }
  return null;
}

function canPublishWeeklyUpdate(update: {
  mux_status?: string | null;
  mux_playback_id?: string | null;
}) {
  return update.mux_status === "ready" && Boolean(update.mux_playback_id);
}

function getWeeklyUpdateSyncError(error: unknown): string {
  const detail = error instanceof Error ? error.message : "Unknown Mux error.";
  if (/abort|timeout|timed out|fetch failed|network/i.test(detail)) {
    return "Mux reageerde niet op tijd. De upload is niet verloren; probeer over enkele seconden opnieuw te syncen.";
  }
  if (/not found|status 404/i.test(detail)) {
    return "Mux verwerkt de upload nog. Wacht enkele seconden en probeer opnieuw te syncen.";
  }
  if (/rate|status 429/i.test(detail)) {
    return "Mux krijgt tijdelijk te veel verzoeken. Wacht even en probeer opnieuw te syncen.";
  }
  return `Mux-sync mislukt: ${detail}`;
}

function getMarketAnalysisSaveError(error: string): string {
  if (error.includes("weekly_updates_one_outlook_per_week")) {
    return "Er bestaat al een weekly outlook voor deze week. Bewerk de bestaande outlook in plaats van een tweede toe te voegen.";
  }
  return error;
}

async function notifyFirstPublication({
  weeklyUpdate,
  actorStudentId,
}: {
  weeklyUpdate: NonNullable<Awaited<ReturnType<typeof getWeeklyUpdateAdmin>>>;
  actorStudentId: string;
}) {
  const notification = await notifyWeeklyUpdatePublished({
    weeklyUpdate,
    actorStudentId,
  });

  if (notification.error) {
    console.error("notifyWeeklyUpdatePublished", notification.error);
  }
}

function readWeeklyUpdateInput(
  formData: FormData,
  existingWeekStartDate?: string | null
) {
  const title = asString(formData.get("title"));
  const slug = slugify(asString(formData.get("slug")) || title);
  const typeRaw = asString(formData.get("type"));
  const type = MARKET_ANALYSIS_TYPES.includes(
    typeRaw as Exclude<MarketAnalysisType, "live_session">
  )
    ? (typeRaw as Exclude<MarketAnalysisType, "live_session">)
    : null;
  const marketRaw = asString(formData.get("market"));
  const market = MARKETS.includes(marketRaw as Market)
    ? (marketRaw as Market)
    : null;
  const automaticDate = new Date().toISOString().slice(0, 10);
  const weekStartDate =
    type === "weekly_outlook"
      ? getMondayDate(
          existingWeekStartDate
            ? new Date(`${existingWeekStartDate}T12:00:00`)
            : new Date()
        )
      : existingWeekStartDate ?? automaticDate;
  const accessTierRaw = asString(formData.get("access_tier"));
  const accessTier = ACCESS_TIERS.includes(accessTierRaw as WeeklyUpdateAccessTier)
    ? (accessTierRaw as WeeklyUpdateAccessTier)
    : null;
  const isPublished = asBoolean(formData.get("is_published"));

  if (!title) return { error: "Title is required." as const };
  if (!slug) return { error: "Slug is required." as const };
  if (!type) return { error: "Kies verplicht een videotype." as const };
  if (type === "market_update" && !market) {
    return { error: "Kies verplicht een markt voor deze markt update." as const };
  }
  if (!weekStartDate || Number.isNaN(Date.parse(weekStartDate))) {
    return { error: "Choose a valid week date." as const };
  }
  if (!accessTier) return { error: "Choose a valid access tier." as const };

  return {
    input: {
      title,
      slug,
      summary: asNullableString(formData.get("summary")),
      key_takeaways: asLineList(formData.get("key_takeaways")),
      type,
      market: type === "market_update" ? market : null,
      week_start_date: weekStartDate,
      mentor_student_id: asNullableString(formData.get("mentor_student_id")),
      access_tier: accessTier,
      thumbnail_url: asNullableString(formData.get("thumbnail_url")),
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
    },
  };
}

export async function adminCreateWeeklyUpdate(
  formData: FormData
): Promise<ActionResult<{ weeklyUpdateId?: number }>> {
  const { actorStudent } = await requireAdmin();
  const parsed = readWeeklyUpdateInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };
  if (parsed.input.is_published) {
    return {
      success: false,
      error: "Upload en sync eerst een Mux-video voordat je publiceert.",
    };
  }

  const { weeklyUpdate, error } = await createWeeklyUpdateAdmin({
    ...parsed.input,
    created_by_student_id: actorStudent.id,
    video_provider: "mux",
    mux_playback_policy: "public",
  });
  if (error) return { success: false, error: getMarketAnalysisSaveError(error) };

  logAdminAction("weekly_update.created", {
    actorStudentId: actorStudent.id,
    metadata: { weeklyUpdateId: weeklyUpdate?.id, title: parsed.input.title },
  });

  revalidateWeeklyUpdatePaths(weeklyUpdate?.slug);
  return { success: true, weeklyUpdateId: weeklyUpdate?.id };
}

export async function adminUpdateWeeklyUpdate(
  weeklyUpdateIdRaw: unknown,
  formData: FormData
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const weeklyUpdateId = parsePositiveInteger(weeklyUpdateIdRaw);
  if (!weeklyUpdateId) return { success: false, error: "Ongeldige marktanalyse." };

  const currentWeeklyUpdate = await getWeeklyUpdateAdmin(weeklyUpdateId);
  if (!currentWeeklyUpdate) {
    return { success: false, error: "Marktanalyse niet gevonden." };
  }

  const parsed = readWeeklyUpdateInput(
    formData,
    currentWeeklyUpdate.week_start_date
  );
  if ("error" in parsed) return { success: false, error: parsed.error };

  const wasPublished = currentWeeklyUpdate.is_published;
  const willPublish = parsed.input.is_published && !wasPublished;
  if (wasPublished && parsed.input.slug !== currentWeeklyUpdate.slug) {
    return {
      success: false,
      error:
        "De slug van een gepubliceerde marktanalyse kan niet worden aangepast.",
    };
  }
  if (willPublish && !canPublishWeeklyUpdate(currentWeeklyUpdate)) {
    return {
      success: false,
      error: "Upload en sync eerst een Mux-video voordat je publiceert.",
    };
  }

  const input = {
    ...parsed.input,
    published_at: parsed.input.is_published
      ? currentWeeklyUpdate.published_at ?? parsed.input.published_at
      : null,
  };

  const { error } = await updateWeeklyUpdateAdmin(weeklyUpdateId, input);
  if (error) return { success: false, error: getMarketAnalysisSaveError(error) };

  if (willPublish) {
    const updatedWeeklyUpdate = await getWeeklyUpdateAdmin(weeklyUpdateId);
    if (updatedWeeklyUpdate) {
      await notifyFirstPublication({
        weeklyUpdate: updatedWeeklyUpdate,
        actorStudentId: actorStudent.id,
      });
    }
  }

  logAdminAction("weekly_update.updated", {
    actorStudentId: actorStudent.id,
    metadata: { weeklyUpdateId, title: input.title },
  });

  revalidateWeeklyUpdatePaths(input.slug);
  return { success: true };
}

export async function adminDeleteWeeklyUpdate(
  weeklyUpdateIdRaw: unknown
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const weeklyUpdateId = parsePositiveInteger(weeklyUpdateIdRaw);
  if (!weeklyUpdateId) return { success: false, error: "Ongeldige marktanalyse." };

  const weeklyUpdate = await getWeeklyUpdateAdmin(weeklyUpdateId);
  if (!weeklyUpdate) return { success: false, error: "Marktanalyse niet gevonden." };

  const { error } = await deleteWeeklyUpdateAdmin(weeklyUpdateId);
  if (error) return { success: false, error };

  logAdminAction("weekly_update.deleted", {
    actorStudentId: actorStudent.id,
    metadata: { weeklyUpdateId, title: weeklyUpdate.title },
  });

  revalidateWeeklyUpdatePaths(weeklyUpdate.slug);
  return { success: true };
}

export async function adminCreateWeeklyUpdateMuxUpload(
  weeklyUpdateIdRaw: unknown
): Promise<ActionResult<{ uploadId?: string; uploadUrl?: string }>> {
  const { actorStudent } = await requireAdmin();
  const weeklyUpdateId = parsePositiveInteger(weeklyUpdateIdRaw);
  if (!weeklyUpdateId) return { success: false, error: "Ongeldige marktanalyse." };

  const weeklyUpdate = await getWeeklyUpdateAdmin(weeklyUpdateId);
  if (!weeklyUpdate) return { success: false, error: "Marktanalyse niet gevonden." };

  try {
    const upload = await createMuxDirectUpload({
      passthrough: { entityType: "weekly_update", entityId: weeklyUpdateId },
      corsOrigin: getCorsOrigin(),
      playbackPolicy: "public",
    });

    const { error } = await updateWeeklyUpdateVideoAdmin(weeklyUpdateId, {
      video_provider: "mux",
      mux_upload_id: upload.id,
      mux_status: "preparing",
      mux_playback_policy: "public",
      mux_asset_id: null,
      mux_playback_id: null,
      mux_error_message: null,
      // Never leave a published update pointing at a playback ID that was
      // just cleared. The admin can publish again once the replacement is ready.
      ...(weeklyUpdate.is_published
        ? { is_published: false, published_at: null }
        : {}),
    });
    if (error) return { success: false, error };

    logAdminAction("weekly_update.mux_upload_created", {
      actorStudentId: actorStudent.id,
      metadata: { weeklyUpdateId, uploadId: upload.id },
    });

    revalidateWeeklyUpdatePaths(weeklyUpdate.slug);
    return { success: true, uploadId: upload.id, uploadUrl: upload.url };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not create Mux upload.",
    };
  }
}

export async function adminCreateWeeklyUpdateWithMuxUpload(
  formData: FormData
): Promise<ActionResult<{ weeklyUpdateId?: number; uploadId?: string; uploadUrl?: string }>> {
  const { actorStudent } = await requireAdmin();
  const parsed = readWeeklyUpdateInput(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };
  if (parsed.input.is_published) {
    return {
      success: false,
      error: "Upload en sync eerst een Mux-video voordat je publiceert.",
    };
  }

  const { weeklyUpdate, error } = await createWeeklyUpdateAdmin({
    ...parsed.input,
    created_by_student_id: actorStudent.id,
    video_provider: "mux",
    mux_status: "preparing",
    mux_playback_policy: "public",
  });
  if (error || !weeklyUpdate) {
    return {
      success: false,
      error: error
        ? getMarketAnalysisSaveError(error)
        : "De marktanalyse kon niet worden toegevoegd.",
    };
  }

  try {
    const upload = await createMuxDirectUpload({
      passthrough: { entityType: "weekly_update", entityId: weeklyUpdate.id },
      corsOrigin: getCorsOrigin(),
      playbackPolicy: "public",
    });

    const updated = await updateWeeklyUpdateVideoAdmin(weeklyUpdate.id, {
      mux_upload_id: upload.id,
      mux_status: "preparing",
      mux_error_message: null,
    });
    if (updated.error) return { success: false, error: updated.error };

    logAdminAction("weekly_update.created_with_mux_upload", {
      actorStudentId: actorStudent.id,
      metadata: { weeklyUpdateId: weeklyUpdate.id, uploadId: upload.id },
    });

    revalidateWeeklyUpdatePaths(weeklyUpdate.slug);
    return {
      success: true,
      weeklyUpdateId: weeklyUpdate.id,
      uploadId: upload.id,
      uploadUrl: upload.url,
    };
  } catch (error) {
    await updateWeeklyUpdateVideoAdmin(weeklyUpdate.id, {
      mux_status: "errored",
      mux_error_message:
        error instanceof Error ? error.message : "Could not create Mux upload.",
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not create Mux upload.",
    };
  }
}

export async function adminSyncWeeklyUpdateMuxUpload(
  weeklyUpdateIdRaw: unknown,
  uploadIdRaw?: unknown
): Promise<ActionResult<{ status?: string }>> {
  const { actorStudent } = await requireAdmin();
  const weeklyUpdateId = parsePositiveInteger(weeklyUpdateIdRaw);
  if (!weeklyUpdateId) return { success: false, error: "Ongeldige marktanalyse." };

  const weeklyUpdate = await getWeeklyUpdateAdmin(weeklyUpdateId);
  if (!weeklyUpdate) return { success: false, error: "Marktanalyse niet gevonden." };

  const uploadId =
    typeof uploadIdRaw === "string" && uploadIdRaw.trim()
      ? uploadIdRaw.trim()
      : weeklyUpdate.mux_upload_id;

  if (!uploadId) {
    return { success: false, error: "Deze marktanalyse heeft nog geen Mux-upload." };
  }

  if (
    uploadIdRaw &&
    weeklyUpdate.mux_upload_id &&
    uploadId !== weeklyUpdate.mux_upload_id
  ) {
    return {
      success: false,
      error:
        "Deze sync hoort bij een oudere upload. De nieuwste video is behouden; vernieuw de pagina en sync opnieuw.",
    };
  }

  try {
    const upload = await getMuxUpload(uploadId);
    const uploadError = getMuxErrorMessage(upload.error);

    if (uploadError) {
      const { error } = await updateWeeklyUpdateVideoAdmin(weeklyUpdateId, {
        mux_upload_id: upload.id,
        mux_status: "errored",
        mux_error_message: uploadError,
      });
      if (error) return { success: false, error };
      revalidateWeeklyUpdatePaths(weeklyUpdate.slug);
      return { success: true, status: "errored" };
    }

    if (!upload.asset_id) {
      const { error } = await updateWeeklyUpdateVideoAdmin(weeklyUpdateId, {
        mux_upload_id: upload.id,
        mux_status: "preparing",
        mux_error_message: null,
      });
      if (error) return { success: false, error };
      revalidateWeeklyUpdatePaths(weeklyUpdate.slug);
      return { success: true, status: upload.status ?? "preparing" };
    }

    const asset = await getMuxAsset(upload.asset_id);
    const playback =
      asset.playback_ids?.find((p) => p.policy === "public") ??
      asset.playback_ids?.[0] ??
      null;
    const assetError = getMuxErrorMessage(asset.errors);
    const muxStatus =
      asset.status === "ready"
        ? "ready"
        : asset.status === "errored"
          ? "errored"
          : "preparing";
    const playbackUrl = playback ? `https://stream.mux.com/${playback.id}.m3u8` : null;

    const { error } = await updateWeeklyUpdateVideoAdmin(weeklyUpdateId, {
      video_provider: "mux",
      video_url: playbackUrl,
      video_duration_seconds:
        typeof asset.duration === "number" ? Math.round(asset.duration) : null,
      thumbnail_url:
        weeklyUpdate.thumbnail_url ?? getMuxThumbnailUrl(playback?.id ?? null),
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

    logAdminAction("weekly_update.mux_upload_synced", {
      actorStudentId: actorStudent.id,
      metadata: {
        weeklyUpdateId,
        uploadId: upload.id,
        assetId: asset.id,
        status: muxStatus,
      },
    });

    revalidateWeeklyUpdatePaths(weeklyUpdate.slug);
    return { success: true, status: muxStatus };
  } catch (error) {
    return {
      success: false,
      error: getWeeklyUpdateSyncError(error),
    };
  }
}

export async function adminCreateWeeklyUpdateThumbnailUpload(
  weeklyUpdateIdRaw: unknown,
  fileInput: ThumbnailUploadInput
): Promise<ActionResult<{ path?: string; token?: string; publicUrl?: string }>> {
  const { actorStudent } = await requireAdmin();
  const weeklyUpdateId = parsePositiveInteger(weeklyUpdateIdRaw);
  if (!weeklyUpdateId) return { success: false, error: "Ongeldige marktanalyse." };

  const validationError = validateThumbnailUpload(fileInput);
  if (validationError) return { success: false, error: validationError };

  const db = await createClient();
  const extension = THUMBNAIL_MIME_EXTENSIONS[fileInput.type ?? ""] ?? "jpg";
  const path = `weekly-updates/${weeklyUpdateId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await db.storage
    .from(THUMBNAIL_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create thumbnail upload.",
    };
  }

  const publicUrl = db.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path).data.publicUrl;

  logAdminAction("weekly_update.thumbnail_upload_created", {
    actorStudentId: actorStudent.id,
    metadata: { weeklyUpdateId, path },
  });

  return { success: true, path: data.path, token: data.token, publicUrl };
}

export async function adminUpdateWeeklyUpdateThumbnail(
  weeklyUpdateIdRaw: unknown,
  thumbnailUrlRaw: unknown
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const weeklyUpdateId = parsePositiveInteger(weeklyUpdateIdRaw);
  if (!weeklyUpdateId) return { success: false, error: "Ongeldige marktanalyse." };

  const thumbnailUrl = asNullableString(thumbnailUrlRaw);
  if (!thumbnailUrl) return { success: false, error: "Thumbnail URL is required." };

  const { error } = await updateWeeklyUpdateVideoAdmin(weeklyUpdateId, {
    thumbnail_url: thumbnailUrl,
  });
  if (error) return { success: false, error };

  logAdminAction("weekly_update.thumbnail_updated", {
    actorStudentId: actorStudent.id,
    metadata: { weeklyUpdateId },
  });

  revalidateWeeklyUpdatePaths();
  return { success: true };
}
