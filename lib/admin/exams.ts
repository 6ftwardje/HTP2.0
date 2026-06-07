import { createClient } from "@/lib/supabase/server";
import type { AdminExamAttemptSummary } from "@/lib/admin/types";
import type { Exam } from "@/lib/types";

/**
 * Per-module exam summary: latest score, pass flag, attempts, and whether any attempt passed.
 * Call only after `requireAdmin()` (e.g. from `buildAdminStudentProgressDetail`).
 */
export async function getExamSummariesByModuleForStudent(
  studentId: string,
  moduleIds: number[]
): Promise<Map<number, AdminExamAttemptSummary>> {
  const result = new Map<number, AdminExamAttemptSummary>();

  if (process.env.NODE_ENV === "test" || moduleIds.length === 0) {
    return result;
  }

  const db = await createClient();

  const { data: exams, error: examsError } = await db
    .from("exams")
    .select("*")
    .in("module_id", moduleIds);

  if (examsError || !exams?.length) {
    return result;
  }

  const examRows = exams as Exam[];
  const examIds = examRows.map((e) => e.id);

  const { data: allResults } = await db
    .from("exam_results")
    .select("exam_id, score, passed, submitted_at")
    .eq("student_id", studentId)
    .in("exam_id", examIds)
    .order("submitted_at", { ascending: false });

  const byExam = new Map<
    number,
    { score: number; passed: boolean; submitted_at: string }[]
  >();
  for (const row of allResults ?? []) {
    const r = row as {
      exam_id: number;
      score: number;
      passed: boolean;
      submitted_at: string;
    };
    const list = byExam.get(r.exam_id) ?? [];
    list.push({
      score: r.score,
      passed: r.passed,
      submitted_at: r.submitted_at,
    });
    byExam.set(r.exam_id, list);
  }

  for (const ex of examRows) {
    const attempts = byExam.get(ex.id) ?? [];
    const latest = attempts[0] ?? null;
    const hasPassed = attempts.some((a) => a.passed);
    result.set(ex.module_id, {
      exam: ex,
      latestResult: latest,
      attemptCount: attempts.length,
      hasPassed,
    });
  }

  return result;
}
