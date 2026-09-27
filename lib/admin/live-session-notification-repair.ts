export type LiveSessionNotificationType =
  | "live_session.scheduled"
  | "live_session.cancelled";

/** Only current, published sessions have a useful notification to repair. */
export function repairableLiveSessionNotificationType(
  session: { is_published: boolean; status: string; ends_at: string },
  now = new Date()
): LiveSessionNotificationType | null {
  if (!session.is_published) return null;
  if (session.status === "cancelled") return "live_session.cancelled";
  if (
    (session.status === "scheduled" || session.status === "live") &&
    new Date(session.ends_at) > now
  ) {
    return "live_session.scheduled";
  }
  return null;
}
