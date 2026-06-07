"use server";

import { revalidatePath } from "next/cache";
import { getLessonById } from "@/lib/lessons";
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

  const { error } = await upsertLessonActionProgress({
    studentId: student.id,
    lessonId,
    actionIndex,
    completed,
  });

  if (error) {
    return { success: false, error: "Je opdracht kon niet worden bijgewerkt." };
  }

  const [overview, onboarding] = await Promise.all([
    getDashboardOverview(student.id),
    getStudentOnboardingResponse(student.id),
  ]);
  await syncStudentNextStep({
    studentId: student.id,
    intakeComplete: onboardingIsComplete(onboarding),
    dashboardNextStep: overview.nextStep,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/lessons/${lesson.slug}`);
  return { success: true };
}
