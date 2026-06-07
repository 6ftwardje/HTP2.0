import { createClient } from "@/lib/supabase/server";
import type { Progress } from "@/lib/types";

/**
 * Get progress rows for a student and a set of lesson IDs.
 * Returns a map of lesson_id -> progress (watched, watched_at).
 */
export async function getProgressByLessonIds(
  studentId: string,
  lessonIds: number[]
): Promise<Map<number, { watched: boolean; watched_at: string | null }>> {
  if (lessonIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("progress")
    .select("lesson_id, watched, watched_at")
    .eq("student_id", studentId)
    .in("lesson_id", lessonIds);

  if (error) return new Map();

  const map = new Map<number, { watched: boolean; watched_at: string | null }>();
  for (const row of data ?? []) {
    const r = row as { lesson_id: number; watched: boolean; watched_at: string | null };
    map.set(r.lesson_id, { watched: r.watched, watched_at: r.watched_at });
  }
  return map;
}

/**
 * Create or update progress for one lesson: set watched = true, watched_at = now.
 * Uses upsert on (student_id, lesson_id) to avoid duplicates.
 */
export async function upsertLessonProgress(
  studentId: string,
  lessonId: number
): Promise<{ error: Error | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("progress").upsert(
    {
      student_id: studentId,
      lesson_id: lessonId,
      watched: true,
      watched_at: new Date().toISOString(),
    },
    {
      onConflict: "student_id,lesson_id",
      ignoreDuplicates: false,
    }
  );

  if (error) return { error };
  return { error: null };
}

/**
 * Check if all lessons in the list are completed for this student.
 */
export async function areAllLessonsCompleted(
  studentId: string,
  lessonIds: number[]
): Promise<boolean> {
  if (lessonIds.length === 0) return true;
  const map = await getProgressByLessonIds(studentId, lessonIds);
  return lessonIds.every((id) => map.get(id)?.watched === true);
}
