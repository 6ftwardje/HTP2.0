import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/students";
import type { NotificationEvent, NotificationWithEvent } from "@/lib/types";

export type NotificationActionResult =
  | { success: true }
  | { success: false; error: string };

function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("does not exist");
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { student } = await getCurrentStudent();
  if (!student) return 0;

  const db = await createClient();
  const { count, error } = await db
    .from("notification_recipients")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .is("read_at", null)
    .is("archived_at", null);

  if (error) {
    if (!isMissingTable(error)) console.error("getUnreadNotificationCount", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function listMyNotifications(): Promise<{
  notifications: NotificationWithEvent[];
  missingMigration: boolean;
}> {
  const { student } = await getCurrentStudent();
  if (!student) return { notifications: [], missingMigration: false };

  const db = await createClient();
  const { data, error } = await db
    .from("notification_recipients")
    .select(
      "id, event_id, student_id, read_at, archived_at, created_at, event:notification_events(id, type, actor_student_id, target_table, target_id, title, body, href, metadata, created_at)"
    )
    .eq("student_id", student.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingTable(error)) return { notifications: [], missingMigration: true };
    console.error("listMyNotifications", error.message);
    return { notifications: [], missingMigration: false };
  }

  return {
    notifications: (data ?? []).map((row) => ({
      ...row,
      event: Array.isArray(row.event)
        ? ((row.event[0] as NotificationEvent | undefined) ?? null)
        : ((row.event as NotificationEvent | null) ?? null),
    })) as NotificationWithEvent[],
    missingMigration: false,
  };
}

export async function markNotificationRead(
  notificationId: string
): Promise<NotificationActionResult> {
  const { student } = await getCurrentStudent();
  if (!student) return { success: false, error: "Niet ingelogd." };

  const db = await createClient();
  const { error } = await db
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("student_id", student.id);

  if (error) {
    console.error("markNotificationRead", error.message);
    return { success: false, error: "Melding bijwerken mislukt." };
  }

  return { success: true };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const { student } = await getCurrentStudent();
  if (!student) return { success: false, error: "Niet ingelogd." };

  const db = await createClient();
  const { error } = await db
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("student_id", student.id)
    .is("read_at", null)
    .is("archived_at", null);

  if (error) {
    console.error("markAllNotificationsRead", error.message);
    return { success: false, error: "Meldingen bijwerken mislukt." };
  }

  return { success: true };
}
