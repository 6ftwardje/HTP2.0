import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
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
  return !!response?.completed_at;
}
