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
  return { success: true };
}
