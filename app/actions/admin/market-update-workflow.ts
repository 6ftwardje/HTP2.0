"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { createWeeklyUpdateAdmin, getWeeklyUpdateAdmin } from "@/lib/admin/weekly-updates";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { publicAuthorName } from "@/lib/market-update-author";
import { getUpdateStructure, isOpenSetup } from "@/lib/market-update-structure";
import { applyMarketUpdateWorkflow, duplicateMarketUpdateStructure, structureFallbackBody, type WorkflowCommand } from "@/lib/market-update-editing";
import type { WeeklyUpdate } from "@/lib/types";

type Result = { success: boolean; error?: string; weeklyUpdateId?: number };
const conflict = "De update is intussen gewijzigd. Vernieuw de pagina voordat je verdergaat.";

function validId(id: number) { return Number.isSafeInteger(id) && id > 0; }

function refreshUpdate(slug: string) {
  revalidatePath("/admin/market-analysis");
  revalidatePath("/admin/weekly-updates");
  revalidatePath("/market-analysis");
  revalidatePath(`/market-analysis/${slug}`);
  revalidatePath(`/weekly-updates/${slug}`);
  revalidatePath("/updates", "layout");
  revalidatePath("/dashboard");
}

async function persist(update: WeeklyUpdate, patch: Record<string, unknown>): Promise<Result> {
  const db = await createClient();
  const { data, error } = await db.from("weekly_updates").update(patch).eq("id", update.id).eq("updated_at", update.updated_at).select("id").maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: conflict };
  refreshUpdate(update.slug);
  return { success: true };
}

export async function adminUpdateMarketUpdateWorkflow(id: number, command: WorkflowCommand): Promise<Result> {
  const { actorStudent } = await requireAdmin();
  if (!validId(id) || !command || typeof command !== "object") return { success: false, error: "Ongeldige update of opvolgactie." };
  const update = await getWeeklyUpdateAdmin(id);
  if (!update) return { success: false, error: "Update niet gevonden." };
  const prepared = applyMarketUpdateWorkflow(update, command, publicAuthorName(actorStudent));
  if (prepared.error) return { success: false, error: prepared.error };
  const result = await persist(update, { update_structure: prepared.structure });
  if (result.success) await logAdminAction("weekly_update.updated", { actorStudentId: actorStudent.id, metadata: { weeklyUpdateId: id, workflowAction: command.action } });
  return result;
}

export async function adminArchiveMarketUpdate(id: number, archive: boolean, expectedUpdatedAt: string): Promise<Result> {
  const { actorStudent } = await requireAdmin();
  if (!validId(id) || typeof archive !== "boolean") return { success: false, error: "Ongeldige update." };
  const update = await getWeeklyUpdateAdmin(id);
  if (!update || (update.type !== "market_update" && update.type !== null)) return { success: false, error: "Marktupdate niet gevonden." };
  if (expectedUpdatedAt !== update.updated_at) return { success: false, error: conflict };
  if (!update.is_published) return { success: false, error: "Alleen gepubliceerde updates gaan naar het archief." };
  if (archive && isOpenSetup(update)) return { success: false, error: "Sluit de open setup eerst af voordat je archiveert." };
  const structure = getUpdateStructure(update);
  const result = await persist(update, {
    actuality_status: archive ? "archive" : "current",
    ...(structure && archive ? { update_structure: { ...structure, pinned_rank: null, pin_until: null, urgent_until: null } } : {}),
  });
  if (result.success) await logAdminAction("weekly_update.updated", { actorStudentId: actorStudent.id, metadata: { weeklyUpdateId: id, archived: archive } });
  return result;
}

export async function adminDuplicateMarketUpdate(id: number): Promise<Result> {
  const { actorStudent } = await requireAdmin();
  if (!validId(id)) return { success: false, error: "Ongeldige update." };
  const source = await getWeeklyUpdateAdmin(id);
  if (!source || source.type !== "market_update") return { success: false, error: "Marktupdate niet gevonden." };
  const structure = getUpdateStructure(source);
  const copiedStructure = structure ? duplicateMarketUpdateStructure(structure) : null;
  const body = structure && copiedStructure && source.body === structureFallbackBody(structure, source.summary)
    ? structureFallbackBody(copiedStructure, source.summary) : source.body;
  const title = `${source.title.slice(0, 91)} (kopie)`;
  const { weeklyUpdate: copy, error } = await createWeeklyUpdateAdmin({
    title, slug: `${source.slug.slice(0, 65)}-${crypto.randomUUID().slice(0, 8)}`,
    summary: source.summary, body, content_format: source.content_format,
    content_kind: source.content_kind, intro: source.intro, article_html: source.article_html,
    type: "market_update", market: source.market, markets: source.markets ?? [],
    week_start_date: new Date().toISOString().slice(0, 10),
    mentor_student_id: actorStudent.id, created_by_student_id: actorStudent.id,
    access_tier: source.access_tier, thumbnail_url: source.thumbnail_url,
    key_takeaways: source.key_takeaways, actuality_status: "current",
    event_context: source.event_context ?? null, period_label: null,
    chapters: source.chapters ?? [], related_content: source.related_content ?? [],
    needs_review: !structure, is_published: false, published_at: null,
    video_provider: source.video_provider, video_url: source.video_url,
    video_duration_seconds: source.video_duration_seconds,
    mux_asset_id: source.mux_asset_id, mux_playback_id: source.mux_playback_id,
    mux_playback_policy: source.mux_playback_policy, mux_status: source.mux_status,
    ...(copiedStructure ? { update_structure: copiedStructure } : {}),
  });
  if (error || !copy) return { success: false, error: error ?? "Dupliceren is mislukt." };
  // Chart objects must be independent: deleting an image from this concept must
  // never remove the original post's image.
  if (source.image_paths.length || source.article_html?.includes(`/api/market-updates/${id}/images/`)) {
    const storage = createServiceClient().storage.from("market-update-charts");
    const paths: string[] = [];
    for (const path of source.image_paths) {
      const suffix = path.match(/\.(jpg|png|webp)$/i)?.[1] ?? "webp";
      const target = `weekly-updates/${copy.id}/${crypto.randomUUID()}.${suffix}`;
      const result = await storage.copy(path, target);
      if (result.error) {
        // Keep already-copied files attached to the recoverable draft.
        if (paths.length) await (await createClient()).from("weekly_updates").update({ image_paths: paths }).eq("id", copy.id);
        refreshUpdate(copy.slug);
        return { success: false, weeklyUpdateId: copy.id, error: "Het concept is bewaard, maar niet alle charts konden worden gekopieerd. Controleer het concept voordat je publiceert." };
      }
      paths.push(target);
    }
    const { error: attachError } = await (await createClient()).from("weekly_updates").update({
      image_paths: paths,
      ...(source.article_html ? { article_html: source.article_html.replaceAll(`/api/market-updates/${id}/images/`, `/api/market-updates/${copy.id}/images/`) } : {}),
    }).eq("id", copy.id);
    if (attachError) return { success: false, weeklyUpdateId: copy.id, error: "Het concept is bewaard; het koppelen van de gekopieerde charts is mislukt." };
  }
  await logAdminAction("weekly_update.created", { actorStudentId: actorStudent.id, metadata: { weeklyUpdateId: copy.id, duplicatedFrom: id } });
  refreshUpdate(copy.slug);
  return { success: true, weeklyUpdateId: copy.id };
}
