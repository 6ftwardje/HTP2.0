"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { createClient } from "@/lib/supabase/server";
import { getDashboardOverview } from "@/lib/dashboard";
import { normalizeConfidenceScore } from "@/lib/intake";
import { notifyMentorsStudentIntakeCompleted } from "@/lib/intake-notifications";
import { syncStudentNextStep } from "@/lib/next-steps";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numberValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return normalizeConfidenceScore(value);
}

function hasRequiredIntake(formData: FormData) {
  const confidenceScore = numberValue(formData, "confidence_score");
  return [
    "experience_level",
    "primary_market",
    "main_challenge",
    "goal_90_days",
    "weekly_time_commitment",
    "mentorship_interest",
  ].every((key) => textValue(formData, key)) &&
    confidenceScore !== null;
}

export async function saveOnboarding(formData: FormData) {
  const { student } = await ensureCurrentStudent();
  if (!student) {
    redirect("/");
  }

  if (!hasRequiredIntake(formData)) {
    redirect("/onboarding?error=incomplete");
  }

  const confidenceScore = numberValue(formData, "confidence_score");
  if (confidenceScore === null) {
    redirect("/onboarding?error=incomplete");
  }

  const completedAt = new Date().toISOString();
  const db = await createClient();
  const intakeResponse = {
    student_id: student.id,
    experience_level: textValue(formData, "experience_level"),
    primary_market: textValue(formData, "primary_market"),
    main_challenge: textValue(formData, "main_challenge"),
    goal_90_days: textValue(formData, "goal_90_days"),
    weekly_time_commitment: textValue(formData, "weekly_time_commitment"),
    mentorship_interest: textValue(formData, "mentorship_interest"),
    confidence_score: confidenceScore,
    completed_at: completedAt,
    intake_version: "v1",
    tools: {},
  };

  const { data: savedResponse, error: saveError } = await db
    .from("student_onboarding_responses")
    .upsert(intakeResponse, { onConflict: "student_id" })
    .select("id, confidence_score, completed_at")
    .single();

  if (saveError || !savedResponse) {
    console.error("saveOnboarding", saveError?.message);
    redirect("/onboarding?error=save_failed");
  }

  if (
    normalizeConfidenceScore(savedResponse.confidence_score) !== confidenceScore ||
    !savedResponse.completed_at
  ) {
    console.error("saveOnboarding intake fields were not persisted");
    redirect("/onboarding?error=save_failed");
  }

  const { error: studentUpdateError } = await db
    .from("students")
    .update({ onboarding_skipped_at: null })
    .eq("id", student.id);

  if (studentUpdateError) {
    console.error("saveOnboarding student update", studentUpdateError.message);
    redirect("/onboarding?error=save_failed");
  }

  const overview = await getDashboardOverview(student.id, student.access_level);
  await syncStudentNextStep({
    studentId: student.id,
    intakeComplete: true,
    dashboardNextStep: overview.nextStep,
  });

  await notifyMentorsStudentIntakeCompleted(student.id);

  revalidatePath("/dashboard");
  revalidatePath("/account");
  revalidatePath("/modules");
  revalidatePath(`/admin/students/${student.id}`);
  revalidatePath("/admin/students");
  redirect("/dashboard?intake=completed");
}

export async function skipOnboarding() {
  const { student } = await ensureCurrentStudent();
  if (!student) {
    redirect("/");
  }

  const db = await createClient();
  await db
    .from("students")
    .update({ onboarding_skipped_at: new Date().toISOString() })
    .eq("id", student.id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
