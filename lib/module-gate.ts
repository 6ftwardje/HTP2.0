import type { Module } from "@/lib/types";
import type { StudentOnboardingResponse } from "@/lib/types";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export const FREE_ACCESS_MODULE_LIMIT = 3;
export const FULL_COURSE_ACCESS_LEVEL = 2;

/**
 * Module access:
 * - before intake: only the first module can be previewed, video lessons stay locked;
 * - after intake: free accounts get the first 3 published modules;
 * - access level 2+ gets every published module.
 */
export async function getModuleAccessMap(
  studentId: string,
  modules: Module[]
): Promise<Map<number, boolean>> {
  const ordered = [...modules].sort((a, b) => a.order_index - b.order_index);
  const map = new Map(ordered.map((module) => [module.id, false]));
  if (ordered.length === 0) return map;

  const supabase = await createClient();
  const [onboarding, resultsRes, studentRes] = await Promise.all([
    getStudentOnboardingResponse(studentId),
    supabase
      .from("exam_results")
      .select("exam_id, passed")
      .eq("student_id", studentId)
      .eq("passed", true),
    supabase
      .from("students")
      .select("access_level")
      .eq("id", studentId)
      .maybeSingle(),
  ]);

  const passedExamIds = new Set(
    (resultsRes.data ?? []).map((r: { exam_id: number }) => r.exam_id)
  );

  // We need "passed exam for module with order_index K" to unlock "module with order_index K+1"
  const examIdByModuleId = new Map<number, number>();
  const { data: exams } = await supabase
    .from("exams")
    .select("id, module_id")
    .in(
      "module_id",
      ordered.map((m) => m.id)
    );
  for (const e of exams ?? []) {
    const row = e as { id: number; module_id: number };
    examIdByModuleId.set(row.module_id, row.id);
  }

  return buildModuleAccessMap(
    ordered,
    onboarding,
    passedExamIds,
    examIdByModuleId,
    studentRes.data?.access_level ?? 1
  );
}

export function buildModuleAccessMap(
  modules: Module[],
  onboarding: StudentOnboardingResponse | null,
  passedExamIds: Set<number>,
  examIdByModuleId: Map<number, number>,
  accessLevel = 1
): Map<number, boolean> {
  const map = new Map<number, boolean>();
  if (modules.length === 0) return map;

  const ordered = [...modules].sort((a, b) => a.order_index - b.order_index);
  const hasCompletedIntake = onboardingIsComplete(onboarding);
  const hasFullCourseAccess = accessLevel >= FULL_COURSE_ACCESS_LEVEL;

  for (let i = 0; i < ordered.length; i++) {
    const mod = ordered[i];

    if (hasCompletedIntake && hasFullCourseAccess) {
      map.set(mod.id, true);
    } else if (hasCompletedIntake && i < FREE_ACCESS_MODULE_LIMIT) {
      map.set(mod.id, true);
    } else if (i === 0) {
      map.set(mod.id, true);
    } else {
      const prevModule = ordered[i - 1];
      const prevExamId = examIdByModuleId.get(prevModule.id);
      const prevPassed = prevExamId ? passedExamIds.has(prevExamId) : false;
      map.set(mod.id, prevPassed);
    }
  }

  return map;
}

export function canAccessModule(
  moduleId: number,
  accessMap: Map<number, boolean>
): boolean {
  return accessMap.get(moduleId) === true;
}
