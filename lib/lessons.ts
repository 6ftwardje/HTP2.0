import { createClient } from "@/lib/supabase/server";
import type { Lesson } from "@/lib/types";

export async function getLessonBySlug(slug: string): Promise<Lesson | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Lesson;
}

export async function getLessonById(lessonId: number): Promise<Lesson | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Lesson;
}

export async function getPublishedLessonsByModuleId(
  moduleId: number
): Promise<Lesson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("module_id", moduleId)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (error) return [];
  return (data ?? []) as Lesson[];
}

export async function getLessonCountByModuleId(
  moduleId: number
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("module_id", moduleId)
    .eq("is_published", true);

  if (error) return 0;
  return count ?? 0;
}

export async function getLessonCountsByModuleIds(
  moduleIds: number[]
): Promise<Map<number, number>> {
  const counts = new Map(moduleIds.map((id) => [id, 0]));
  if (moduleIds.length === 0) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("module_id")
    .in("module_id", moduleIds)
    .eq("is_published", true);

  if (error) return counts;

  for (const row of data ?? []) {
    const lesson = row as { module_id: number };
    counts.set(lesson.module_id, (counts.get(lesson.module_id) ?? 0) + 1);
  }

  return counts;
}

export async function getPublishedLessonsByModuleIds(
  moduleIds: number[]
): Promise<Lesson[]> {
  if (moduleIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .in("module_id", moduleIds)
    .eq("is_published", true)
    .order("module_id", { ascending: true })
    .order("order_index", { ascending: true });

  if (error) return [];
  return (data ?? []) as Lesson[];
}
