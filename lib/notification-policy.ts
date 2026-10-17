/** Presentation and age policy only. Authorization stays in event/recipient RLS. */
export const NOTIFICATION_PREVIEW_LIMIT = 5;
export const NOTIFICATION_PAGE_SIZE = 25;
export const NOTIFICATION_BADGE_DAYS = 30;

export function notificationBadgeSince(now: number = Date.now()) {
  return new Date(now - NOTIFICATION_BADGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function notificationBadgeLabel(count: number) {
  return count > 9 ? "9+" : String(Math.max(0, count));
}

export function notificationHref(value: string | null | undefined) {
  // A notification never redirects to an external or executable URL.
  return value?.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u0020]/.test(value) ? value : null;
}

export function notificationPresentation(type: string | null | undefined) {
  if (type === "mentor_reply" || type === "mentor_new_message" || type === "student_intake.completed") return { kind: "question", label: "Vraag" } as const;
  if (type === "weekly_update.published") return { kind: "update", label: "Nieuwe update" } as const;
  if (type?.startsWith("module.")) return { kind: "module", label: "Nieuwe module" } as const;
  if (type?.startsWith("live_session.")) return { kind: "live", label: "Livesessie" } as const;
  if (type?.startsWith("technical.") || type?.startsWith("maintenance.")) return { kind: "technical", label: "Technische update" } as const;
  return { kind: "system", label: "Systeem" } as const;
}

export type NotificationSource = { table: "weekly_updates" | "live_sessions" | "modules" | "lessons"; id: string };
export function validNotificationSources(value: NotificationSource[]) {
  return Array.isArray(value) && value.length <= 40 && value.every((v) => v &&
    ["weekly_updates", "live_sessions", "modules", "lessons"].includes(v.table) &&
    typeof v.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(v.id));
}

export type NotificationItem = {
  id: string; title: string; description: string; timestamp: string;
  read: boolean; href: string | null; type?: string;
};
