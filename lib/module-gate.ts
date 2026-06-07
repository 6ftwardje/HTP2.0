import type { Module } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

/**
 * For each module (by order_index), check if the student has passed the *previous* module's exam.
 * Module 1 is always accessible. Module N+1 requires passed exam for module N.
 * Returns a map: moduleId -> boolean (true = can access).
 */
export async function getModuleAccessMap(
  studentId: string,
  modules: Module[]
): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>();
  if (modules.length === 0) return map;

  const ordered = [...modules].sort((a, b) => a.order_index - b.order_index);

  const supabase = await createClient();
  const { data: results } = await supabase
    .from("exam_results")
    .select("exam_id, passed")
    .eq("student_id", studentId)
    .eq("passed", true);

  const passedExamIds = new Set(
    (results ?? []).map((r: { exam_id: number }) => r.exam_id)
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

  for (let i = 0; i < ordered.length; i++) {
    const mod = ordered[i];
    if (i === 0) {
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
