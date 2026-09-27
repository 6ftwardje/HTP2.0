import type { Module } from "@/lib/types";
import type { StudentOnboardingResponse } from "@/lib/types";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import {
  buildModuleEntitlementMap,
} from "@/lib/module-access-policy";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export { FREE_ACCESS_MODULE_LIMIT, FULL_COURSE_ACCESS_LEVEL } from "@/lib/module-access-policy";

/**
 * Module access:
 * - before intake: free students can explore module one and watch its first lesson;
 * - after intake: free students get the first three published modules;
 * - access level 2+ gets every published module, whether intake is complete or not.
 * - an existing free student keeps only modules frozen at cutover.
 * Passing an exam after cutover never changes the paid entitlement boundary.
 */
export async function getModuleAccessMap(
  studentId: string,
  modules: Module[]
): Promise<Map<number, boolean>> {
  const ordered = [...modules].sort((a, b) => a.order_index - b.order_index);
  const map = new Map(ordered.map((module) => [module.id, false]));
  if (ordered.length === 0) return map;

  const supabase = await createClient();
  const [onboarding, studentRes, legacyAccessModuleIds] = await Promise.all([
    getStudentOnboardingResponse(studentId),
    supabase
      .from("students")
      .select("access_level")
      .eq("id", studentId)
      .maybeSingle(),
    getLegacyAcademyModuleIds(studentId),
  ]);

  if (studentRes.error) {
    logError("module_access.student_query_failed", studentRes.error, {
      studentId,
    });
  }

  return buildModuleAccessMap(
    ordered,
    onboarding,
    studentRes.data?.access_level ?? 1,
    legacyAccessModuleIds
  );
}

export async function getLegacyAcademyModuleIds(
  studentId: string
): Promise<Set<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("legacy_academy_module_access")
    .select("module_id")
    .eq("student_id", studentId);

  if (error) {
    logError("module_access.legacy_snapshot_query_failed", error, { studentId });
    return new Set<number>();
  }
  return new Set((data ?? []).map((row) => Number(row.module_id)));
}

export function buildModuleAccessMap(
  modules: Module[],
  onboarding: StudentOnboardingResponse | null,
  accessLevel = 1,
  legacyAccessModuleIds: ReadonlySet<number> = new Set<number>()
): Map<number, boolean> {
  return buildModuleEntitlementMap(
    modules,
    onboardingIsComplete(onboarding),
    accessLevel,
    legacyAccessModuleIds
  );
}

export function canAccessModule(
  moduleId: number,
  accessMap: Map<number, boolean>
): boolean {
  return accessMap.get(moduleId) === true;
}
