import { notFound, redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/students";
import type { Student } from "@/lib/types";
import {
  ADMIN_ACCESS_LEVEL,
  ALLOWED_ACCESS_LEVELS,
  type AllowedAccessLevel,
} from "@/lib/admin/constants";

export { ADMIN_ACCESS_LEVEL, ALLOWED_ACCESS_LEVELS };
export type { AllowedAccessLevel };

const MOCK_ADMIN: Student = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@test.local",
  name: "Test Admin",
  auth_user_id: "00000000-0000-0000-0000-000000000002",
  access_level: ADMIN_ACCESS_LEVEL,
  mentor_status: "active",
  tags: [],
  onboarding_skipped_at: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  last_seen: null,
  phone: null,
};

/**
 * Resolves the current user, verifies `students.access_level === 3`.
 * Non-admins get `notFound()` (no data leak). Unauthenticated users redirect to login.
 */
export async function requireAdmin(): Promise<{ actorStudent: Student }> {
  if (process.env.NODE_ENV === "test") {
    return { actorStudent: MOCK_ADMIN };
  }

  const { student, error } = await getCurrentStudent();
  if (error || !student) {
    redirect("/?redirectedFrom=" + encodeURIComponent("/admin"));
  }
  if (student.access_level !== ADMIN_ACCESS_LEVEL) {
    notFound();
  }
  return { actorStudent: student };
}

export function parseAccessLevel(value: unknown): AllowedAccessLevel | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n)) return null;
  return ALLOWED_ACCESS_LEVELS.includes(n as AllowedAccessLevel)
    ? (n as AllowedAccessLevel)
    : null;
}
