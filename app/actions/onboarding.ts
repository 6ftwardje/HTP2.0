"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function checkboxTools(formData: FormData) {
  return {
    tradingview: formData.get("tool_tradingview") === "on",
    tradezella: formData.get("tool_tradezella") === "on",
    discord: formData.get("tool_discord") === "on",
  };
}

export async function saveOnboarding(formData: FormData) {
  const { student } = await ensureCurrentStudent();
  if (!student) {
    redirect("/");
  }

  const db = await createClient();
  await db.from("student_onboarding_responses").upsert(
    {
      student_id: student.id,
      experience_level: textValue(formData, "experience_level"),
      primary_market: textValue(formData, "primary_market"),
      main_challenge: textValue(formData, "main_challenge"),
      goal_90_days: textValue(formData, "goal_90_days"),
      weekly_time_commitment: textValue(formData, "weekly_time_commitment"),
      mentorship_interest: textValue(formData, "mentorship_interest"),
      tools: checkboxTools(formData),
    },
    { onConflict: "student_id" }
  );

  await db
    .from("students")
    .update({ onboarding_skipped_at: null })
    .eq("id", student.id);

  revalidatePath("/dashboard");
  revalidatePath("/account");
  redirect("/dashboard");
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
