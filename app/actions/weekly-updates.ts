"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentStudent } from "@/lib/students";

export async function markWeeklyUpdateWatched(
  weeklyUpdateId: number
): Promise<{ success: boolean; error?: string }> {
  const { student } = await ensureCurrentStudent();
  if (!student) return { success: false, error: "Not authenticated." };

  const db = await createClient();
  const { error } = await db.from("weekly_update_views").upsert(
    {
      student_id: student.id,
      weekly_update_id: weeklyUpdateId,
      watched: true,
      watched_at: new Date().toISOString(),
    },
    { onConflict: "student_id,weekly_update_id" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/weekly-updates");
  return { success: true };
}
