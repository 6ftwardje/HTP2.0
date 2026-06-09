import { createClient } from "@/lib/supabase/server";
import type { Student, WeeklyUpdate, WeeklyUpdateView } from "@/lib/types";

export type WeeklyUpdateWithMentor = WeeklyUpdate & {
  mentor: Pick<Student, "id" | "name" | "email"> | null;
};

export async function listPublishedWeeklyUpdates(
  limit = 12
): Promise<WeeklyUpdateWithMentor[]> {
  const db = await createClient();
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
    .order("week_start_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listPublishedWeeklyUpdates", error.message);
    return [];
  }

  return (data ?? []) as WeeklyUpdateWithMentor[];
}

export async function getPublishedWeeklyUpdateBySlug(
  slug: string
): Promise<WeeklyUpdateWithMentor | null> {
  const db = await createClient();
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

  const db = await createClient();
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
