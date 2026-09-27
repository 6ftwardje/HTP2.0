import { ADMIN_ACCESS_LEVEL } from "./admin/constants.ts";

// Only these event types are intended for students. Staff notifications can
// outlive a role change, so a recipient row alone is not an access check.
// This protects the app display, not direct database reads: RLS and the
// notification-shell RPC still need the same role check before deployment.
export const STUDENT_NOTIFICATION_EVENT_TYPES = [
  "mentor_reply",
  "weekly_update.published",
  "live_session.scheduled",
  "live_session.cancelled",
  "subscription.bonus_expired",
  "subscription.payment_failed",
] as const;

export function canShowNotificationToAccessLevel(
  accessLevel: number,
  eventType: string | null | undefined
) {
  return (
    accessLevel === ADMIN_ACCESS_LEVEL ||
    STUDENT_NOTIFICATION_EVENT_TYPES.some((type) => type === eventType)
  );
}
