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
import { getLegacyAcademyModuleIds, getModuleAccessMap } from "@/lib/module-gate";
import { canOpenLessonWithIntake } from "@/lib/module-access-policy";
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

  const [moduleLessons, modules, onboarding] = await Promise.all([
    getPublishedLessonsByModuleId(lesson.module_id),
    getPublishedModules(),
    getStudentOnboardingResponse(student.id),
  ]);
  const [accessMap, statusMap, legacyAccessModuleIds] = await Promise.all([
    getModuleAccessMap(student.id, modules),
    getLessonStatuses(student.id, moduleLessons),
    getLegacyAcademyModuleIds(student.id),
  ]);
  const moduleData = modules.find((module) => module.id === lesson.module_id);
  if (
    accessMap.get(lesson.module_id) !== true ||
    !["available", "completed"].includes(statusMap.get(lessonId) ?? "locked") ||
    !canOpenLessonWithIntake({
      accessLevel: student.access_level,
      intakeComplete: onboardingIsComplete(onboarding),
      isFreeModule: moduleData?.is_free === true,
      isFirstModule: modules[0]?.id === lesson.module_id,
      isFirstLesson: moduleLessons[0]?.id === lessonId,
      hasLegacyModuleAccess: legacyAccessModuleIds.has(lesson.module_id),
    })
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

  const overview = await getDashboardOverview(student.id, student.access_level);
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
