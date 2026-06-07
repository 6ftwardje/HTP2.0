import { createClient } from "@/lib/supabase/server";
import type { Exam, ExamQuestion, ExamResult } from "@/lib/types";

const EXAM_COLUMNS =
  "id, module_id, title, description, passing_score, is_published";

const EXAM_QUESTION_COLUMNS =
  "id, exam_id, question, options, correct_answer, order_index";

export async function getExamByModuleId(
  moduleId: number
): Promise<Exam | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .select(EXAM_COLUMNS)
    .eq("module_id", moduleId)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Exam;
}

export async function getExamsByModuleIds(
  moduleIds: number[]
): Promise<Map<number, Exam>> {
  const map = new Map<number, Exam>();
  if (moduleIds.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .select(EXAM_COLUMNS)
    .in("module_id", moduleIds)
    .eq("is_published", true);

  if (error) return map;

  for (const row of data ?? []) {
    const exam = row as Exam;
    map.set(exam.module_id, exam);
  }

  return map;
}

export async function getExamQuestions(
  examId: number
): Promise<ExamQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_questions")
    .select(EXAM_QUESTION_COLUMNS)
    .eq("exam_id", examId)
    .order("order_index", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row) => ({
    ...row,
    options: Array.isArray(row.options) ? row.options : [],
  })) as ExamQuestion[];
}

/**
 * Check if the student has at least one passed result for this exam.
 */
export async function hasPassedExam(
  studentId: string,
  examId: number
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_results")
    .select("id")
    .eq("student_id", studentId)
    .eq("exam_id", examId)
    .eq("passed", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

export async function getPassedExamIdsForStudent(
  studentId: string,
  examIds: number[]
): Promise<Set<number>> {
  const passedExamIds = new Set<number>();
  if (examIds.length === 0) return passedExamIds;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_results")
    .select("exam_id")
    .eq("student_id", studentId)
    .eq("passed", true)
    .in("exam_id", examIds);

  if (error) return passedExamIds;

  for (const row of data ?? []) {
    const result = row as { exam_id: number };
    passedExamIds.add(result.exam_id);
  }

  return passedExamIds;
}

/**
 * Get latest exam result for display (optional).
 */
export async function getLatestExamResult(
  studentId: string,
  examId: number
): Promise<ExamResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_results")
    .select("id, student_id, exam_id, score, passed, submitted_at, created_at")
    .eq("student_id", studentId)
    .eq("exam_id", examId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ExamResult;
}

/**
 * Insert an exam result. Call from server action after scoring.
 */
export async function insertExamResult(params: {
  studentId: string;
  examId: number;
  score: number;
  passed: boolean;
}): Promise<{ error: Error | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("exam_results").insert({
    student_id: params.studentId,
    exam_id: params.examId,
    score: params.score,
    passed: params.passed,
  });

  if (error) return { error };
  return { error: null };
}
