import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logError } from "@/lib/logger";
import { normalizeProfileName, normalizeProfilePhone, profileIsComplete, profileCompletionUrl } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";

const STUDENT_COLUMNS =
  "id, email, name, auth_user_id, access_level, mentor_status, tags, onboarding_skipped_at, created_at, updated_at, last_seen, phone";

export const getCurrentAuthUser = cache(async function getCurrentAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user, error: null };
});

const readCurrentStudent = cache(async function readCurrentStudent(): Promise<{
  student: Student | null;
  error: Error | null;
}> {
  const { user, error: authError } = await getCurrentAuthUser();
  if (authError || !user) {
    return { student: null, error: authError ?? new Error("Not authenticated") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return { student: null, error };
  return { student: data as Student | null, error: null };
});

/**
 * Returns the current student, creating one if missing (bootstrap).
 * Uses auth user id, email, and name. Database default is used for access_level.
 */
export const getStudentForProfileCompletion = cache(async function getStudentForProfileCompletion(): Promise<{
  student: Student | null;
  error: Error | null;
}> {
  const { student, error } = await readCurrentStudent();
  if (error) return { student: null, error };
  if (student) {
    const {user} = await getCurrentAuthUser();
    const metadataName = normalizeProfileName(user?.user_metadata?.full_name) ?? normalizeProfileName(user?.user_metadata?.name);
    const metadataPhone = normalizeProfilePhone(user?.user_metadata?.phone);
    if ((!normalizeProfileName(student.name) && metadataName) || (!normalizeProfilePhone(student.phone) && metadataPhone)) {
      const db = await createClient();
      const {data, error:repairError} = await db.rpc("repair_own_student_profile");
      if (repairError) {
        logError("profile.repair.failed", {code:repairError.code,message:"Own metadata repair failed"}, {operation:"repair_own_student_profile"});
        return {student:null,error:new Error("Profielgegevens konden niet worden opgehaald.")};
      }
      if(data?.[0])return {student:data[0] as Student,error:null};
    }
    return {student,error:null};
  }

  const { user, error: authError } = await getCurrentAuthUser();
  if (authError || !user?.email) {
    return {
      student: null,
      error: authError ?? new Error("No auth user or email"),
    };
  }

  const supabase = await createClient();
  const { data: inserted, error: insertError } = await supabase
    .from("students")
    .insert({
      auth_user_id: user.id,
      email: user.email,
      name: normalizeProfileName(user.user_metadata?.full_name) ?? normalizeProfileName(user.user_metadata?.name),
      phone: normalizeProfilePhone(user.user_metadata?.phone),
    })
    .select(STUDENT_COLUMNS)
    .single();

  if (insertError?.code === "23505") {
    // Layout and page can bootstrap the same new account concurrently.
    const existing = await supabase.from("students").select(STUDENT_COLUMNS)
      .eq("auth_user_id", user.id).maybeSingle();
    if (!existing.error && existing.data) return { student: existing.data as Student, error: null };
  }
  if (insertError) return { student: null, error: insertError };
  return { student: inserted as Student, error: null };
});

async function completeProfileGate(result: {student:Student|null;error:Error|null}) {
  if(result.student && !profileIsComplete(result.student)) {
    const requestHeaders = await headers();
    redirect(profileCompletionUrl(requestHeaders.get("x-htp-return-to")));
  }
  return result;
}

/** Normal server entry points cannot expose content/actions to an incomplete profile. */
export const getCurrentStudent = cache(async function getCurrentStudent() {
  return completeProfileGate(await getStudentForProfileCompletion());
});
export const ensureCurrentStudent = getCurrentStudent;
