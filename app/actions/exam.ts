"use server";

import { ensureCurrentStudent } from "@/lib/students";
import { getExamQuestions, insertExamResult } from "@/lib/exams";
import { createClient } from "@/lib/supabase/server";

/**
 * Submit exam answers, compute score, and insert exam_results.
 * answers: array of { questionId: number, selectedAnswer: string } in order.
 */
export async function submitExam(
  examId: number,
  answers: { questionId: number; selectedAnswer: string }[]
): Promise<{
  success: boolean;
  score?: number;
  passed?: boolean;
  error?: string;
}> {
  const { student, error: studentError } = await ensureCurrentStudent();
  if (studentError || !student) {
    return { success: false, error: "Je bent niet aangemeld." };
  }

  const questions = await getExamQuestions(examId);
  if (questions.length === 0) {
    return { success: false, error: "Deze toets bevat nog geen vragen." };
  }

  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedAnswer]));
  let correct = 0;
  for (const q of questions) {
    const selected = answerMap.get(q.id);
    if (selected != null && selected === q.correct_answer) {
      correct++;
    }
  }

  const score = Math.round((correct / questions.length) * 100);

  const supabase = await createClient();
  const { data: exam } = await supabase
    .from("exams")
    .select("passing_score")
    .eq("id", examId)
    .single();
  const passingScore = (exam as { passing_score: number } | null)?.passing_score ?? 70;
  const passed = score >= passingScore;

  const { error: insertError } = await insertExamResult({
    studentId: student.id,
    examId,
    score,
    passed,
  });

  if (insertError) {
    return { success: false, error: "Je resultaat kon niet worden opgeslagen." };
  }

  return { success: true, score, passed };
}
