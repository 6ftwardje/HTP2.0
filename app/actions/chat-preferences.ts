"use server";

import { createClient } from "@/lib/supabase/server";

export type ChatEmailPreference = { enabled: boolean; suppressed: boolean };
type PreferenceResult = { success: true; preference: ChatEmailPreference } | { success: false; error: string };

async function preferenceRequest(enabled?: boolean): Promise<PreferenceResult> {
  try {
    const db = await createClient();
    const { data, error } = enabled === undefined
      ? await db.rpc("get_my_chat_email_preferences")
      : await db.rpc("set_my_chat_email_preference", { p_enabled: enabled });
    if (error || typeof data?.enabled !== "boolean" || typeof data?.suppressed !== "boolean") return { success: false, error: "E-mailvoorkeur ophalen is niet gelukt. Probeer opnieuw." };
    return { success: true, preference: { enabled: data.enabled, suppressed: data.suppressed } };
  } catch { return { success: false, error: "E-mailvoorkeur opslaan is niet gelukt. Probeer opnieuw." }; }
}

export async function getChatEmailPreference() { return preferenceRequest(); }
export async function setChatEmailPreference(enabled: boolean) {
  if (typeof enabled !== "boolean") return { success: false as const, error: "Ongeldige voorkeur." };
  return preferenceRequest(enabled);
}
