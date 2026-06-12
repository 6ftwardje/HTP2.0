"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import {
  archiveExamQuestionAdmin,
  saveExamQuestionAdmin,
  setExamQuestionActiveAdmin,
  validateAdminExamQuestionInput,
  type AdminExamQuestionInput,
} from "@/lib/admin/exams";

type ActionResult<T extends object = object> = T & {
  success: boolean;
  error?: string;
};

function parsePositiveInteger(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseQuestionInput(raw: AdminExamQuestionInput): AdminExamQuestionInput | null {
  const moduleId = parsePositiveInteger(raw.moduleId);
  const parsedId = raw.id == null ? undefined : parsePositiveInteger(raw.id);
  if (!moduleId || (raw.id != null && !parsedId)) return null;

  return {
    id: parsedId ?? undefined,
    moduleId,
    questionText: typeof raw.questionText === "string" ? raw.questionText : "",
    explanation:
      typeof raw.explanation === "string" && raw.explanation.trim()
        ? raw.explanation
        : null,
    isActive: raw.isActive === true,
    options: Array.isArray(raw.options)
      ? raw.options.map((option) => ({
          id:
            option.id == null
              ? undefined
              : parsePositiveInteger(option.id) ?? undefined,
          optionText:
            typeof option.optionText === "string" ? option.optionText : "",
          isCorrect: option.isCorrect === true,
        }))
      : [],
  };
}

function revalidateExamAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/exams");
  revalidatePath("/modules");
}

export async function adminSaveExamQuestion(
  raw: AdminExamQuestionInput
): Promise<ActionResult<{ questionId?: number }>> {
  const { actorStudent } = await requireAdmin();
  const input = parseQuestionInput(raw);
  if (!input) return { success: false, error: "Invalid question input." };

  const validationError = validateAdminExamQuestionInput(input);
  if (validationError) return { success: false, error: validationError };

  const { questionId, error } = await saveExamQuestionAdmin(input, actorStudent.id);
  if (error) return { success: false, error };

  logAdminAction(input.id ? "exam.question_updated" : "exam.question_created", {
    actorStudentId: actorStudent.id,
    metadata: {
      moduleId: input.moduleId,
      questionId,
      sourceQuestionId: input.id ?? null,
    },
  });

  revalidateExamAdminPaths();
  return { success: true, questionId: questionId ?? undefined };
}

export async function adminSetExamQuestionActive(
  questionIdRaw: unknown,
  isActive: boolean
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const questionId = parsePositiveInteger(questionIdRaw);
  if (!questionId) return { success: false, error: "Invalid question." };

  const { error } = await setExamQuestionActiveAdmin(
    questionId,
    isActive,
    actorStudent.id
  );
  if (error) return { success: false, error };

  logAdminAction("exam.question_active_changed", {
    actorStudentId: actorStudent.id,
    metadata: { questionId, isActive },
  });

  revalidateExamAdminPaths();
  return { success: true };
}

export async function adminArchiveExamQuestion(
  questionIdRaw: unknown
): Promise<ActionResult> {
  const { actorStudent } = await requireAdmin();
  const questionId = parsePositiveInteger(questionIdRaw);
  if (!questionId) return { success: false, error: "Invalid question." };

  const { error } = await archiveExamQuestionAdmin(questionId, actorStudent.id);
  if (error) return { success: false, error };

  logAdminAction("exam.question_archived", {
    actorStudentId: actorStudent.id,
    metadata: { questionId },
  });

  revalidateExamAdminPaths();
  return { success: true };
}
