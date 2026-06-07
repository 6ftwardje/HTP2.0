"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import {
  markStudentModuleComplete,
  resetStudentModuleLessonProgress,
  resetStudentAllLessonProgress,
  markStudentAcademyLessonsComplete,
} from "@/lib/admin/progress";
import { logAdminAction } from "@/lib/admin/audit";

function parseNumericId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export async function adminMarkStudentModuleComplete(
  studentId: string,
  moduleIdRaw: unknown
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();
  const moduleId = parseNumericId(moduleIdRaw);
  if (!moduleId) return { success: false, error: "Invalid module" };

  const { error } = await markStudentModuleComplete(studentId, moduleId);
  if (error) return { success: false, error };

  logAdminAction("progress.module_marked_complete", {
    actorStudentId: actorStudent.id,
    targetStudentId: studentId,
    metadata: { moduleId },
  });

  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}

export async function adminResetStudentModuleProgress(
  studentId: string,
  moduleIdRaw: unknown
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();
  const moduleId = parseNumericId(moduleIdRaw);
  if (!moduleId) return { success: false, error: "Invalid module" };

  const { error } = await resetStudentModuleLessonProgress(studentId, moduleId);
  if (error) return { success: false, error };

  logAdminAction("progress.module_reset", {
    actorStudentId: actorStudent.id,
    targetStudentId: studentId,
    metadata: { moduleId, scope: "lessons_only" },
  });

  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}

export async function adminResetStudentAllProgress(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();

  const { error } = await resetStudentAllLessonProgress(studentId);
  if (error) return { success: false, error };

  logAdminAction("progress.all_lessons_reset", {
    actorStudentId: actorStudent.id,
    targetStudentId: studentId,
    metadata: { scope: "lessons_only" },
  });

  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}

export async function adminMarkAcademyLessonsComplete(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();

  const { error } = await markStudentAcademyLessonsComplete(studentId);
  if (error) return { success: false, error };

  logAdminAction("progress.academy_lessons_marked_complete", {
    actorStudentId: actorStudent.id,
    targetStudentId: studentId,
  });

  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}
