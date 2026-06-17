import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { normalizeConfidenceScore } from "@/lib/intake";
import type { StudentOnboardingResponse } from "@/lib/types";

export const getStudentOnboardingResponse = cache(
  async function getStudentOnboardingResponse(
    studentId: string
  ): Promise<StudentOnboardingResponse | null> {
    const db = await createClient();
    const { data, error } = await db
      .from("student_onboarding_responses")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error || !data) return null;
    return data as StudentOnboardingResponse;
  }
);

export function onboardingIsComplete(
  response: StudentOnboardingResponse | null
) {
  if (!response) return false;
  if (response.completed_at) return true;

  return hasRequiredIntake(response);
}

export function hasRequiredIntake(response: StudentOnboardingResponse | null) {
  if (!response) return false;

  return [
    response.experience_level,
    response.primary_market,
    response.main_challenge,
    response.goal_90_days,
    response.weekly_time_commitment,
    response.mentorship_interest,
  ].every((value) => typeof value === "string" && value.trim().length > 0) &&
    normalizeConfidenceScore(response.confidence_score) !== null;
}
