import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/students";
import type { NotificationEvent, NotificationWithEvent } from "@/lib/types";
import { notificationBadgeSince, NOTIFICATION_PAGE_SIZE, NOTIFICATION_PREVIEW_LIMIT } from "@/lib/notification-policy";

export type NotificationActionResult = { success: true } | { success: false; error: string };
export type NotificationShellReadModel = {
  version: 2;
  studentId: string;
  unreadCount: number;
  notifications: {
    id: string; created_at: string; read_at: string | null;
    event: { type: string; title: string | null; body: string | null; href: string | null } | null;
  }[];
};
export type NotificationPage = {
  notifications: NotificationWithEvent[];
  totalCount: number;
  unreadTotal: number;
  missingMigration: boolean;
  error: string | null;
};
const columns = "id,event_id,student_id,read_at,archived_at,created_at,event:notification_events!inner(id,type,actor_student_id,target_table,target_id,title,body,href,metadata,created_at)";
const empty: NotificationPage = { notifications: [], totalCount: 0, unreadTotal: 0, missingMigration: false, error: null };
function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205" || error?.message?.includes("does not exist");
}
function failedPage(error: { code?: string; message?: string }): NotificationPage {
  console.error("listMyNotifications", error.message);
  return { ...empty, missingMigration: Boolean(isMissingTable(error)), error: "Meldingen laden is niet gelukt. Probeer opnieuw." };
}
function mapRows(rows: unknown[]): NotificationWithEvent[] {
  return rows.map((value) => {
    const row = value as NotificationWithEvent & { event: NotificationEvent | NotificationEvent[] | null };
    return { ...row, event: Array.isArray(row.event) ? row.event[0] ?? null : row.event };
  });
}

export const getNotificationShellReadModel = cache(async function getNotificationShellReadModel(expectedStudentId: string): Promise<NotificationShellReadModel | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("get_my_notification_shell");
  const payload = data as NotificationShellReadModel | null;
  // Old deployments return eight rows and an unbounded badge. Fall back to
  // current table queries until v2 is applied, rather than silently using them.
  if (error || !payload || payload.version !== 2 || payload.studentId !== expectedStudentId ||
      !Number.isInteger(payload.unreadCount) || payload.unreadCount < 0 ||
      !Array.isArray(payload.notifications) || payload.notifications.length > NOTIFICATION_PREVIEW_LIMIT ||
      payload.notifications.some((n) => !n.event || typeof n.event.type !== "string")) return null;
  return payload;
});

export async function getUnreadNotificationCount(): Promise<number> {
  const { student } = await getCurrentStudent();
  if (!student) return 0;
  const shell = await getNotificationShellReadModel(student.id);
  if (shell) return shell.unreadCount;
  const db = await createClient();
  const { count, error } = await db.from("notification_recipients")
    .select("id,event:notification_events!inner(id)", { count: "exact", head: true })
    .eq("student_id", student.id).is("read_at", null).is("archived_at", null)
    .gte("created_at", notificationBadgeSince());
  if (error) console.error("getUnreadNotificationCount", error.message);
  return error ? 0 : count ?? 0;
}

export async function listMyNotifications({ offset = 0, limit = NOTIFICATION_PAGE_SIZE, recent = false }: {
  offset?: number; limit?: number; recent?: boolean;
} = {}): Promise<NotificationPage> {
  const { student } = await getCurrentStudent();
  if (!student) return { ...empty };
  offset = Number.isInteger(offset) ? Math.min(1_000_000, Math.max(0, offset)) : 0;
  limit = Number.isInteger(limit) ? Math.min(50, Math.max(1, limit)) : NOTIFICATION_PAGE_SIZE;
  const db = await createClient();
  if (!recent) {
    const { data, error } = await db.rpc("get_my_notifications_page", { p_limit: limit, p_offset: offset });
    if (!error && data && Array.isArray(data.notifications) &&
        Number.isInteger(data.totalCount) && Number.isInteger(data.unreadTotal)) {
      return { ...empty, notifications: data.notifications as NotificationWithEvent[], totalCount: data.totalCount, unreadTotal: data.unreadTotal };
    }
    // Only a missing RPC permits fallback. Real SQL/auth/network failures remain
    // visible and retryable instead of being presented as an empty inbox.
    if (error && error.code !== "PGRST202" && error.code !== "42883") return failedPage(error);
  }
  const query = (head = false) => db.from("notification_recipients")
    .select(columns, { count: "exact", head }).eq("student_id", student.id).is("archived_at", null);
  const ordered = () => query().order("created_at", { ascending: false }).order("id", { ascending: false });
  if (recent) {
    const { data, error, count } = await ordered().range(0, limit - 1);
    return error ? failedPage(error) : { ...empty, notifications: mapRows(data ?? []), totalCount: count ?? 0 };
  }
  // The compatibility path paginates unread/read separately: ordering read_at
  // itself would incorrectly sort read history by read time instead of creation.
  const [unread, read] = await Promise.all([query(true).is("read_at", null), query(true).not("read_at", "is", null)]);
  if (unread.error || read.error) return failedPage((unread.error || read.error)!);
  const unreadTotal = unread.count ?? 0, totalCount = unreadTotal + (read.count ?? 0);
  const notifications: NotificationWithEvent[] = [];
  const unreadLimit = Math.min(limit, Math.max(0, unreadTotal - offset));
  if (unreadLimit) {
    const { data, error } = await ordered().is("read_at", null).range(offset, offset + unreadLimit - 1);
    if (error) return failedPage(error);
    notifications.push(...mapRows(data ?? []));
  }
  if (notifications.length < limit) {
    const readOffset = Math.max(0, offset - unreadTotal);
    const { data, error } = await ordered().not("read_at", "is", null).range(readOffset, readOffset + limit - notifications.length - 1);
    if (error) return failedPage(error);
    notifications.push(...mapRows(data ?? []));
  }
  return { ...empty, notifications, totalCount, unreadTotal };
}

export async function markNotificationRead(notificationId: string): Promise<NotificationActionResult> {
  const { student } = await getCurrentStudent();
  if (!student) return { success: false, error: "Niet ingelogd." };
  const db = await createClient();
  const own = () => db.from("notification_recipients").select("id,read_at")
    .eq("id", notificationId).eq("student_id", student.id).is("archived_at", null);
  const { data: row, error: readError } = await own().maybeSingle();
  if (readError) return { success: false, error: "Melding laden is niet gelukt. Probeer opnieuw." };
  if (!row) return { success: false, error: "Deze melding is verwijderd of niet meer toegankelijk." };
  if (row.read_at) return { success: true };
  const { error } = await db.from("notification_recipients").update({ read_at: new Date().toISOString() })
    .eq("id", notificationId).eq("student_id", student.id).is("read_at", null).is("archived_at", null);
  return error ? { success: false, error: "Melding bijwerken is niet gelukt. Probeer opnieuw." } : { success: true };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const { student } = await getCurrentStudent();
  if (!student) return { success: false, error: "Niet ingelogd." };
  const db = await createClient();
  // No page, age or default PostgREST row limit: update the entire own set.
  const { error } = await db.from("notification_recipients").update({ read_at: new Date().toISOString() })
    .eq("student_id", student.id).is("read_at", null).is("archived_at", null);
  return error ? { success: false, error: "Meldingen bijwerken is niet gelukt. Probeer opnieuw." } : { success: true };
}

export async function archiveNotification(notificationId: string): Promise<NotificationActionResult> {
  const { student } = await getCurrentStudent();
  if (!student) return { success: false, error: "Niet ingelogd." };
  const db = await createClient();
  const { data, error } = await db.from("notification_recipients").update({ archived_at: new Date().toISOString() })
    .eq("id", notificationId).eq("student_id", student.id).select("id").maybeSingle();
  if (error) return { success: false, error: "Verwijderen is niet gelukt. Probeer opnieuw." };
  return data ? { success: true } : { success: false, error: "Deze melding is niet meer toegankelijk." };
}

/** One shell contract for student and admin layouts. */
export async function getNotificationChrome(studentId: string) {
  const shell = await getNotificationShellReadModel(studentId);
  const [unreadNotificationCount, recent] = shell
    ? [shell.unreadCount, { notifications: shell.notifications, error: null }]
    : await Promise.all([getUnreadNotificationCount(), listMyNotifications({ recent: true, limit: NOTIFICATION_PREVIEW_LIMIT })]);
  return {
    unreadNotificationCount,
    notificationError: recent.error,
    floatingNotifications: recent.notifications.map((n) => ({
      id: n.id, title: n.event?.title ?? "Melding", description: n.event?.body ?? "",
      timestamp: n.created_at, read: Boolean(n.read_at), href: n.event?.href ?? null,
      type: n.event?.type ?? "system",
    })),
  };
}

export async function markSourceNotificationsRead(targets: import("@/lib/notification-policy").NotificationSource[]): Promise<NotificationActionResult & { changed?: number }> {
  const { validNotificationSources } = await import("@/lib/notification-policy");
  if (!validNotificationSources(targets)) return { success: false, error: "Ongeldige bron voor deze melding." };
  const { student } = await getCurrentStudent();
  if (!student) return { success: false, error: "Niet ingelogd." };
  const db = await createClient();
  let changed = 0;
  for (const table of [...new Set(targets.map((t) => t.table))]) {
    const ids = [...new Set(targets.filter((t) => t.table === table).map((t) => t.id))];
    const { data, error } = await db.rpc("mark_my_source_notifications_read", { p_table: table, p_ids: ids });
    if (!error) { changed += Number(data) || 0; continue; }
    if (error.code !== "PGRST202" && error.code !== "42883") return { success: false, error: "De gelezenstatus kon niet worden bijgewerkt. Probeer opnieuw." };
    // Compatibility with an installation where the additive RPC is not present.
    for (;;) {
      const page = await db.from("notification_recipients")
        .select("id,event:notification_events!inner(target_table,target_id)")
        .eq("student_id", student.id).is("read_at", null).is("archived_at", null)
        .eq("event.target_table", table).in("event.target_id", ids).limit(200);
      if (page.error) return { success: false, error: "De gelezenstatus kon niet worden geladen. Probeer opnieuw." };
      const recipientIds = (page.data ?? []).map((n) => n.id);
      if (!recipientIds.length) break;
      const update = await db.from("notification_recipients").update({ read_at: new Date().toISOString() })
        .eq("student_id", student.id).in("id", recipientIds).is("read_at", null).is("archived_at", null).select("id");
      if (update.error) return { success: false, error: "De gelezenstatus kon niet worden bijgewerkt. Probeer opnieuw." };
      changed += update.data?.length ?? 0;
      if (recipientIds.length < 200) break;
    }
  }
  return { success: true, changed };
}
