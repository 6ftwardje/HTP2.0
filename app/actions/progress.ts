"use server";

import { ensureCurrentStudent } from "@/lib/students";
import { upsertLessonProgress } from "@/lib/progress";

export async function markLessonComplete(lessonId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const { student, error: studentError } = await ensureCurrentStudent();
  if (studentError || !student) {
    return { success: false, error: "Je bent niet aangemeld." };
  }

  const { error } = await upsertLessonProgress(student.id, lessonId);
  if (error) {
    return { success: false, error: "Je voortgang kon niet worden opgeslagen." };
  }
  return { success: true };
}
