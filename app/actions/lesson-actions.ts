"use server";

import { revalidatePath } from "next/cache";
import { getLessonById, getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getPublishedModules } from "@/lib/modules";
import { getModuleAccessMap } from "@/lib/module-gate";
import { getLessonStatuses } from "@/lib/lesson-gate";
import { canOpenLessonWithIntake, FREE_ACCESS_MODULE_LIMIT, FULL_COURSE_ACCESS_LEVEL } from "@/lib/module-access-policy";
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
  const [accessMap, statusMap] = await Promise.all([
    getModuleAccessMap(student.id, modules),
    getLessonStatuses(student.id, moduleLessons),
  ]);
  const moduleIndex = modules.findIndex((module) => module.id === lesson.module_id);
  const hasLegacyModuleAccess = student.access_level < FULL_COURSE_ACCESS_LEVEL &&
    moduleIndex >= FREE_ACCESS_MODULE_LIMIT && accessMap.get(lesson.module_id) === true;
  if (
    accessMap.get(lesson.module_id) !== true ||
    !["available", "completed"].includes(statusMap.get(lessonId) ?? "locked") ||
    !canOpenLessonWithIntake({
      accessLevel: student.access_level,
      intakeComplete: onboardingIsComplete(onboarding),
      isFirstModule: modules[0]?.id === lesson.module_id,
      isFirstLesson: moduleLessons[0]?.id === lessonId,
      hasLegacyModuleAccess,
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
