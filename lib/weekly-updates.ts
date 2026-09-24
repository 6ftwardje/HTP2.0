import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { paidProductsEnabled } from "@/lib/billing";
import type { Market, Student, WeeklyUpdate, WeeklyUpdateView } from "@/lib/types";

export type WeeklyUpdateWithMentor = WeeklyUpdate & {
  mentor: Pick<Student, "id" | "name" | "email"> | null;
};

async function contentClient() {
  return paidProductsEnabled() ? await createClient() : createServiceClient();
}

export async function listPublishedWeeklyUpdates(
  limit = 48
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
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listPublishedWeeklyUpdates", error.message);
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
    console.error("listPublishedWeeklyOutlooks", error.message);
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
    console.error("listPublishedMarketUpdates", error.message);
    return [];
  }

  return (data ?? []) as WeeklyUpdateWithMentor[];
}

export async function listPublishedMarketUpdatesByMarket(
  market: Market,
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
    .eq("content_format", "video")
    .eq("market", market)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listPublishedMarketUpdatesByMarket", error.message);
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

  if (error || !data) return null;
  return data as WeeklyUpdateWithMentor;
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
    console.error("getWeeklyUpdateViewsByIds", error.message);
    return new Map();
  }

  return new Map(
    ((data ?? []) as WeeklyUpdateView[]).map((view) => [
      view.weekly_update_id,
      view,
    ])
  );
}
