"use server";

import { ensureCurrentStudent } from "@/lib/students";
import { submitExamAttempt } from "@/lib/exams";

/**
 * Submit an in-progress attempt. Scoring happens server-side in the
 * `submit_module_exam` RPC against the fixed attempt snapshot.
 */
export async function submitExam(
  attemptId: string,
  answers: { questionId: number; selectedOptionId: number }[]
): Promise<{
  success: boolean;
  score?: number;
  passed?: boolean;
  correctCount?: number;
  totalQuestions?: number;
  error?: string;
}> {
  const { student, error: studentError } = await ensureCurrentStudent();
  if (studentError || !student) {
    return { success: false, error: "Je bent niet aangemeld." };
  }

  if (!attemptId || !Array.isArray(answers)) {
    return { success: false, error: "Ongeldige toetsinzending." };
  }

  const normalizedAnswers = answers
    .map((answer) => ({
      questionId: Number(answer.questionId),
      selectedOptionId: Number(answer.selectedOptionId),
    }))
    .filter(
      (answer) =>
        Number.isInteger(answer.questionId) &&
        answer.questionId > 0 &&
        Number.isInteger(answer.selectedOptionId) &&
        answer.selectedOptionId > 0
    );

  if (normalizedAnswers.length !== answers.length) {
    return { success: false, error: "Een of meer antwoorden zijn ongeldig." };
  }

  return submitExamAttempt({ attemptId, answers: normalizedAnswers });
}
