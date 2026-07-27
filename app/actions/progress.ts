"use server";

import { revalidatePath } from "next/cache";
import { ensureCurrentStudent } from "@/lib/students";
import { upsertLessonProgress } from "@/lib/progress";
import { getDashboardOverview } from "@/lib/dashboard";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import { syncStudentNextStep } from "@/lib/next-steps";
import { getLessonById, getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getPublishedModules } from "@/lib/modules";
import { getModuleAccessMap } from "@/lib/module-gate";
import { getLessonStatuses } from "@/lib/lesson-gate";
import { logError } from "@/lib/logger";

export async function markLessonComplete(lessonId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return { success: false, error: "Ongeldige les." };
  }

  const { student, error: studentError } = await ensureCurrentStudent();
  if (studentError || !student) {
    if (studentError) {
      logError("progress.complete_auth_failed", studentError);
    }
    return { success: false, error: "Je bent niet aangemeld." };
  }

  const lesson = await getLessonById(lessonId);
  if (!lesson) {
    return { success: false, error: "Deze les bestaat niet of is niet gepubliceerd." };
  }

  const [moduleLessons, modules] = await Promise.all([
    getPublishedLessonsByModuleId(lesson.module_id),
    getPublishedModules(),
  ]);
  const [accessMap, statusMap] = await Promise.all([
    getModuleAccessMap(student.id, modules),
    getLessonStatuses(student.id, moduleLessons),
  ]);
  if (
    accessMap.get(lesson.module_id) !== true ||
    statusMap.get(lessonId) === "locked"
  ) {
    logError("progress.complete_access_denied", new Error("Lesson is locked"), {
      studentId: student.id,
      lessonId,
      moduleId: lesson.module_id,
    });
    return {
      success: false,
      error: "Rond eerst de vorige stappen af voordat je deze les voltooit.",
    };
  }

  const { error } = await upsertLessonProgress(student.id, lessonId);
  if (error) {
    return { success: false, error: "Je voortgang kon niet worden opgeslagen." };
  }

  const [overview, onboarding] = await Promise.all([
    getDashboardOverview(student.id, student.access_level),
    getStudentOnboardingResponse(student.id),
  ]);
  await syncStudentNextStep({
    studentId: student.id,
    intakeComplete: onboardingIsComplete(onboarding),
    dashboardNextStep: overview.nextStep,
  });

  revalidatePath("/dashboard");
  revalidatePath("/modules");
  revalidatePath(`/lessons/${lesson.slug}`);
  return { success: true };
}
