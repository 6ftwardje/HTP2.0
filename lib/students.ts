import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";

export const getCurrentAuthUser = cache(async function getCurrentAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user, error: null };
});

export const getCurrentStudent = cache(async function getCurrentStudent(): Promise<{
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
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return { student: null, error };
  return { student: data as Student | null, error: null };
});

/**
 * Returns the current student, creating one if missing (bootstrap).
 * Uses auth user id, email, and name. Database default is used for access_level.
 */
export const ensureCurrentStudent = cache(async function ensureCurrentStudent(): Promise<{
  student: Student | null;
  error: Error | null;
}> {
  const { student, error } = await getCurrentStudent();
  if (error) return { student: null, error };
  if (student) return { student, error: null };

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
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    })
    .select()
    .single();

  if (insertError) return { student: null, error: insertError };
  return { student: inserted as Student, error: null };
});
