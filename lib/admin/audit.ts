import type { Student } from "@/lib/types";

/**
 * Placeholder for future audit logging (who changed what, when).
 * Call from admin mutations after successful writes.
 */
export function logAdminAction(
  _event: string,
  _payload: {
    actorStudentId: string;
    targetStudentId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  // Intentionally no-op in v1 — wire to Supabase `admin_audit_log` or external logger later.
}

export function formatActorLabel(student: Student): string {
  return student.name?.trim() || student.email;
}
