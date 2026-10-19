import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logError } from "@/lib/logger";
import { paidProductsEnabled } from "@/lib/billing";
import {
  projectPublishedVideoEnrichment,
  type PublishedVideoEnrichment,
} from "@/lib/transcription/public-enrichment";
import type { Market, Student, WeeklyUpdate, WeeklyUpdateView } from "@/lib/types";

export type WeeklyUpdateWithMentor = WeeklyUpdate & {
  mentor: Pick<Student, "id" | "name" | "email"> | null;
};

async function contentClient() {
  return paidProductsEnabled() ? await createClient() : createServiceClient();
}

/** Full rubric read: filters apply before pagination so the archive is complete. */
export async function listMarketUpdateRubricUpdates(
  { freeOnly = false }: { freeOnly?: boolean } = {}
): Promise<WeeklyUpdateWithMentor[]> {
  const db = await contentClient();
  const rows: WeeklyUpdateWithMentor[] = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from("weekly_updates")
      .select("*, mentor:students!weekly_updates_mentor_student_id_fkey (id, name, email)")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (freeOnly) query = query.eq("access_tier", "free");
    const { data, error } = await query;
    if (error) {
      logError("market.archive.query_failed", error, { freeOnly, offset, pageSize });
      // Partial archives would make search results misleading.
      throw new Error("Marktupdates konden niet volledig worden geladen.");
    }
    rows.push(...(data ?? []) as WeeklyUpdateWithMentor[]);
    if (!data || data.length < pageSize) return rows;
  }
}

export async function listPublishedWeeklyUpdates(
  limit = 48,
  { freeOnly = false }: { freeOnly?: boolean } = {}
): Promise<WeeklyUpdateWithMentor[]> {
  const db = await contentClient();
  let query = db
    .from("weekly_updates")
    .select(
      `
        *,
        mentor:students!weekly_updates_mentor_student_id_fkey (
          id,
          name,
          email
        )
      `
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  // The pre-billing service client bypasses RLS, so filter before returning
  // video URLs and metadata to the library's Client Component.
  if (freeOnly) query = query.eq("access_tier", "free");
  const { data, error } = await query;

  if (error) {
    logError("market.listPublishedWeeklyUpdates.query_failed", error, { limit, freeOnly });
    return [];
  }

  return (data ?? []) as WeeklyUpdateWithMentor[];
}

export async function listPublishedWeeklyOutlooks(
  limit = 12
): Promise<WeeklyUpdateWithMentor[]> {
  const db = await contentClient();
  const { data, error } = await db
    .from("weekly_updates")
    .select(
      `
        *,
        mentor:students!weekly_updates_mentor_student_id_fkey (
          id,
          name,
          email
        )
      `
    )
    .eq("is_published", true)
    .eq("type", "weekly_outlook")
    .order("week_start_date", { ascending: false })
    .limit(limit);

  if (error) {
    logError("market.listPublishedWeeklyOutlooks.query_failed", error, { limit });
    return [];
  }

  return (data ?? []) as WeeklyUpdateWithMentor[];
}

export async function listPublishedMarketUpdates(
  limit = 60
): Promise<WeeklyUpdateWithMentor[]> {
  const db = await contentClient();
  const { data, error } = await db
    .from("weekly_updates")
    .select(
      `
        *,
        mentor:students!weekly_updates_mentor_student_id_fkey (
          id,
          name,
          email
        )
      `
    )
    .eq("is_published", true)
    .eq("type", "market_update")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logError("market.listPublishedMarketUpdates.query_failed", error, { limit });
    return [];
  }

  return (data ?? []) as WeeklyUpdateWithMentor[];
}

export async function listPublishedMarketUpdatesByMarket(
  market: Market,
  limit = 60,
  { freeOnly = false }: { freeOnly?: boolean } = {}
): Promise<WeeklyUpdateWithMentor[]> {
  const db = await contentClient();
  let query = db
    .from("weekly_updates")
    .select(
      `
        *,
        mentor:students!weekly_updates_mentor_student_id_fkey (
          id,
          name,
          email
        )
      `
    )
    .eq("is_published", true)
    .eq("type", "market_update")
    .eq("content_format", "video")
    .or(`markets.cs.{${market}},market.eq.${market},update_structure->>category.eq.${market}`)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (freeOnly) query = query.eq("access_tier", "free");
  const { data, error } = await query;

  if (error) {
    logError("market.listPublishedMarketUpdatesByMarket.query_failed", error, { market, limit, freeOnly });
    return [];
  }

  return (data ?? []) as WeeklyUpdateWithMentor[];
}

export async function getPublishedWeeklyUpdateBySlug(
  slug: string
): Promise<WeeklyUpdateWithMentor | null> {
  const db = await contentClient();
  const { data, error } = await db
    .from("weekly_updates")
    .select(
      `
        *,
        mentor:students!weekly_updates_mentor_student_id_fkey (
          id,
          name,
          email
        )
      `
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    logError("market.detail.query_failed", error, { slug });
    throw new Error("Het marktinzicht kon niet worden opgehaald.", { cause: error });
  }
  if (!data) return null;
  return data as WeeklyUpdateWithMentor;
}

/**
 * Returns only the reviewed public projection. This deliberately uses the
 * service client after the page has authorized access to the parent video, so
 * draft content, transcript text and provider metadata never enter page props.
 */
export async function getPublishedEnrichmentForWeeklyUpdate(
  weeklyUpdateId: number
): Promise<PublishedVideoEnrichment | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("ai_video_enrichments")
    .select("status, summary, key_takeaways, chapters, published_at, transcript:ai_video_transcripts!inner(weekly_update_id)")
    .eq("status", "published")
    .eq("transcript.weekly_update_id", weeklyUpdateId)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) logError("market.enrichment.query_failed", error, { weeklyUpdateId });
  if (error || !data) return null;
  return projectPublishedVideoEnrichment(data);
}

export async function getWeeklyUpdateViewsByIds(
  studentId: string,
  weeklyUpdateIds: number[]
): Promise<Map<number, WeeklyUpdateView>> {
  if (weeklyUpdateIds.length === 0) return new Map();

  const db = await contentClient();
  const { data, error } = await db
    .from("weekly_update_views")
    .select("*")
    .eq("student_id", studentId)
    .in("weekly_update_id", weeklyUpdateIds);

  if (error) {
    logError("market.getWeeklyUpdateViewsByIds.query_failed", error, { studentId, weeklyUpdateIds });
    return new Map();
  }

  return new Map(
    ((data ?? []) as WeeklyUpdateView[]).map((view) => [
      view.weekly_update_id,
      view,
    ])
  );
}
