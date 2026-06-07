import { createClient } from "@/lib/supabase/server";

export function normalizeLessonActions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getLessonActionProgress(
  studentId: string,
  lessonId: number
): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_action_progress")
    .select("action_index, completed")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId);

  if (error) return map;

  for (const row of data ?? []) {
    const item = row as { action_index: number; completed: boolean };
    map.set(item.action_index, item.completed);
  }

  return map;
}

export async function upsertLessonActionProgress(params: {
  studentId: string;
  lessonId: number;
  actionIndex: number;
  completed: boolean;
}): Promise<{ error: Error | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_action_progress").upsert(
    {
      student_id: params.studentId,
      lesson_id: params.lessonId,
      action_index: params.actionIndex,
      completed: params.completed,
      completed_at: params.completed ? new Date().toISOString() : null,
    },
    {
      onConflict: "student_id,lesson_id,action_index",
      ignoreDuplicates: false,
    }
  );

  return { error };
}
