"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStudentForProfileCompletion } from "@/lib/students";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { normalizeProfileName, normalizeProfilePhone, profileReturnTo } from "@/lib/profile";

export async function completeOwnProfile(form: FormData): Promise<{error: string} | never> {
  const {student, error} = await getStudentForProfileCompletion();
  if (error || !student) return {error:"Je sessie is verlopen. Meld je opnieuw aan."};
  const name = normalizeProfileName(form.get("name"));
  if (!name) return {error:"Vul je eigen naam in (maximaal 100 tekens)."};
  const phone = normalizeProfilePhone(form.get("phone"), String(form.get("phone_country") ?? "BE"));
  if (!phone) return {error:"Vul een geldig telefoonnummer met de juiste landcode in."};
  const db = await createClient();
  try {
    const {data, error: saveError} = await db.rpc("complete_own_student_profile", {p_name:name,p_phone:phone});
    if (saveError || !data?.length) {
      // Database details can contain the user's submitted contact data.
      logError("profile.complete.failed", {code:saveError?.code,message:"Own profile save failed"}, {operation:"complete_own_student_profile"});
      return {error:"Opslaan is niet gelukt. Je invoer is bewaard; probeer opnieuw."};
    }
  } catch {
    logError("profile.complete.transport_failed", new Error("Profile save request failed"), {operation:"complete_own_student_profile"});
    return {error:"Opslaan is niet gelukt. Je invoer is bewaard; probeer opnieuw."};
  }
  for (const path of ["/dashboard","/account","/admin/students","/mentor-inbox"]) revalidatePath(path);
  redirect(profileReturnTo(typeof form.get("next") === "string" ? String(form.get("next")) : null));
}
