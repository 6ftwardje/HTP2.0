"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { createClient } from "@/lib/supabase/server";
import { getDashboardOverview } from "@/lib/dashboard";
import { syncStudentNextStep } from "@/lib/next-steps";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numberValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
    confidenceScore !== null &&
    confidenceScore >= 1 &&
    confidenceScore <= 5;
}

export async function saveOnboarding(formData: FormData) {
  const { student } = await ensureCurrentStudent();
  if (!student) {
    redirect("/");
  }

  if (!hasRequiredIntake(formData)) {
    redirect("/onboarding?error=incomplete");
  }

  const db = await createClient();
  const baseResponse = {
    student_id: student.id,
    experience_level: textValue(formData, "experience_level"),
    primary_market: textValue(formData, "primary_market"),
    main_challenge: textValue(formData, "main_challenge"),
    goal_90_days: textValue(formData, "goal_90_days"),
    weekly_time_commitment: textValue(formData, "weekly_time_commitment"),
    mentorship_interest: textValue(formData, "mentorship_interest"),
    tools: {},
  };

  const { data: savedResponse, error: saveError } = await db
    .from("student_onboarding_responses")
    .upsert(baseResponse, { onConflict: "student_id" })
    .select("id")
    .single();

  if (saveError || !savedResponse) {
    redirect("/onboarding?error=save_failed");
  }

  // These columns are introduced by the intake completion migration. Keep this
  // as a separate best-effort update so the core intake still persists if a
  // deployment temporarily runs before the migration is applied.
  await db
    .from("student_onboarding_responses")
    .update({
      confidence_score: numberValue(formData, "confidence_score"),
      completed_at: new Date().toISOString(),
      intake_version: "v1",
    })
    .eq("student_id", student.id);

  await db
    .from("students")
    .update({ onboarding_skipped_at: null })
    .eq("id", student.id);

  const overview = await getDashboardOverview(student.id);
  await syncStudentNextStep({
    studentId: student.id,
    intakeComplete: true,
    dashboardNextStep: overview.nextStep,
  });

  revalidatePath("/dashboard");
  revalidatePath("/account");
  revalidatePath("/modules");
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
