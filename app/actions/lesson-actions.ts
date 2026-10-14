"use server";

import { revalidatePath } from "next/cache";
import { getLessonById, getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getPublishedModules } from "@/lib/modules";
import { getLegacyAcademyModuleIds, getModuleAccessMap } from "@/lib/module-gate";
import { getLessonStatuses } from "@/lib/lesson-gate";
import { canOpenLessonWithIntake } from "@/lib/module-access-policy";
import { getDashboardOverview } from "@/lib/dashboard";
import {
  normalizeLessonActions,
  upsertLessonActionProgress,
} from "@/lib/lesson-actions";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import { syncStudentNextStep } from "@/lib/next-steps";
import { ensureCurrentStudent } from "@/lib/students";

export async function toggleLessonAction(
  lessonId: number,
  actionIndex: number,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const { student, error: studentError } = await ensureCurrentStudent();
  if (studentError || !student) {
    return { success: false, error: "Je bent niet aangemeld." };
  }

  const lesson = await getLessonById(lessonId);
  const actions = normalizeLessonActions(lesson?.action_items);
  if (!lesson || !Number.isInteger(actionIndex) || actionIndex < 0 || actionIndex >= actions.length) {
    return { success: false, error: "Deze opdracht bestaat niet meer." };
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
    return { success: false, error: "Deze les is nog vergrendeld." };
  }

  const { error } = await upsertLessonActionProgress({
    studentId: student.id,
    lessonId,
    actionIndex,
    completed,
  });

  if (error) {
    return { success: false, error: "Je opdracht kon niet worden bijgewerkt." };
  }

  const overview = await getDashboardOverview(student.id, student.access_level);
  await syncStudentNextStep({
    studentId: student.id,
    intakeComplete: onboardingIsComplete(onboarding),
    dashboardNextStep: overview.nextStep,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/lessons/${lesson.slug}`);
  return { success: true };
}
