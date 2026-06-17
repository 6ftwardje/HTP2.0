import { createClient } from "@/lib/supabase/server";

function isMissingRpc(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    error?.message?.includes("Could not find the function")
  );
}

export async function notifyMentorsStudentIntakeCompleted(studentId: string) {
  const db = await createClient();
  const { data, error } = await db.rpc("notify_student_intake_completed", {
    p_student_id: studentId,
  });

  if (error) {
    if (isMissingRpc(error)) {
      console.warn(
        "notifyMentorsStudentIntakeCompleted: migration missing",
        error.message
      );
      return { notified: 0, skipped: true, error: null };
    }

    console.error("notifyMentorsStudentIntakeCompleted", error.message);
    return { notified: 0, skipped: false, error: error.message };
  }

  const payload = data as {
    notified?: number;
    skipped?: boolean;
    reason?: string;
  } | null;

  return {
    notified: payload?.notified ?? 0,
    skipped: payload?.skipped ?? false,
    error: null,
  };
}
