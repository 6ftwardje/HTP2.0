import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { Student } from "@/lib/types";

/**
 * Best-effort audit after a successful admin mutation. The content write may
 * already be committed, so a logging outage must never report that mutation as
 * failed. Every caller awaits this function to give the insert a chance to
 * finish before its server action returns. Failures are visible in server logs.
 */
export async function logAdminAction(
  event: string,
  payload: {
    actorStudentId: string;
    targetStudentId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { error } = await createServiceClient().from("admin_audit_log").insert({
      event_type: event,
      actor_student_id: payload.actorStudentId,
      target_student_id: payload.targetStudentId ?? null,
      metadata: payload.metadata ?? {},
    });

    if (error) {
      console.error("Admin audit write failed", {
        event,
        code: error.code,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("Admin audit write failed", {
      event,
      message: error instanceof Error ? error.message : "Unknown audit error",
    });
  }
}

export function formatActorLabel(student: Student): string {
  return student.name?.trim() || student.email;
}
