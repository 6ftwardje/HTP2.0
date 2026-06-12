import { createClient } from "@/lib/supabase/server";
import { measureAsync } from "@/lib/performance";
import { requireAdmin } from "@/lib/admin/access";
import type { AdminExamAttemptSummary } from "@/lib/admin/types";
import type { Exam, Module } from "@/lib/types";

export type AdminExamOption = {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: boolean;
  order_index: number;
};

export type AdminExamQuestion = {
  id: number;
  exam_id: number;
  module_id: number;
  question_text: string;
  explanation: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  options: AdminExamOption[];
  attemptCount: number;
};

export type AdminExamModuleSummary = {
  module: Module;
  exam: Exam | null;
  activeQuestionCount: number;
  validActiveQuestionCount: number;
  totalQuestionCount: number;
};

export type AdminExamManagementData = {
  modules: AdminExamModuleSummary[];
  questions: AdminExamQuestion[];
};

export type AdminExamQuestionInput = {
  id?: number;
  moduleId: number;
  questionText: string;
  explanation?: string | null;
  isActive: boolean;
  options: { id?: number; optionText: string; isCorrect: boolean }[];
};

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

  const { data: exams, error: examsError } = await measureAsync(
    "admin.student.detail.exams.query",
    async () => await db.from("exams").select("*").in("module_id", moduleIds),
    { module_count: moduleIds.length }
  );

  if (examsError || !exams?.length) {
    return result;
  }

  const examRows = exams as Exam[];
  const examIds = examRows.map((e) => e.id);

  const { data: allResults } = await measureAsync(
    "admin.student.detail.exam_results.query",
    async () =>
      await db
        .from("exam_results")
        .select("exam_id, score, passed, submitted_at")
        .eq("student_id", studentId)
        .in("exam_id", examIds)
        .order("submitted_at", { ascending: false }),
    { exam_count: examIds.length }
  );

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

function normalizeOptions(
  options: { id?: number; optionText: string; isCorrect: boolean }[]
) {
  return options
    .map((option) => ({
      id: option.id,
      optionText: option.optionText.trim(),
      isCorrect: option.isCorrect,
    }))
    .filter((option) => option.optionText.length > 0);
}

export function validateAdminExamQuestionInput(
  input: AdminExamQuestionInput
): string | null {
  if (!Number.isInteger(input.moduleId) || input.moduleId <= 0) {
    return "Choose a module.";
  }
  if (!input.questionText.trim()) {
    return "Question text is required.";
  }
  if (input.options.some((option) => !option.optionText.trim())) {
    return "Answer options cannot be empty.";
  }

  const options = normalizeOptions(input.options);
  if (options.length < 2) {
    return "Add at least two answer options.";
  }
  const correctCount = options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) {
    return "Exactly one answer option must be marked correct.";
  }

  return null;
}

export async function listExamManagementAdmin(): Promise<AdminExamManagementData> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { modules: [], questions: [] };
  }

  const db = await createClient();
  const [
    modulesResult,
    examsResult,
    questionsResult,
    optionsResult,
    attemptQuestionsResult,
  ] = await Promise.all([
    db.from("modules").select("*").order("order_index", { ascending: true }),
    db.from("exams").select("*"),
    db
      .from("exam_questions")
      .select(
        "id, exam_id, module_id, question_text, explanation, is_active, deleted_at, created_at, updated_at"
      )
      .is("deleted_at", null)
      .order("module_id", { ascending: true })
      .order("order_index", { ascending: true }),
    db
      .from("exam_answer_options")
      .select("id, question_id, option_text, is_correct, order_index")
      .order("order_index", { ascending: true }),
    db.from("exam_attempt_questions").select("question_id"),
  ]);

  if (modulesResult.error) {
    console.error("listExamManagementAdmin modules", modulesResult.error.message);
    return { modules: [], questions: [] };
  }

  const modules = (modulesResult.data ?? []) as Module[];
  const exams = (examsResult.data ?? []) as Exam[];
  const options = (optionsResult.data ?? []) as AdminExamOption[];
  const attemptCounts = new Map<number, number>();
  for (const row of attemptQuestionsResult.data ?? []) {
    const questionId = (row as { question_id: number }).question_id;
    attemptCounts.set(questionId, (attemptCounts.get(questionId) ?? 0) + 1);
  }

  const optionsByQuestion = new Map<number, AdminExamOption[]>();
  for (const option of options) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }

  const questions = ((questionsResult.data ?? []) as Omit<
    AdminExamQuestion,
    "options" | "attemptCount"
  >[]).map((question) => ({
    ...question,
    options: optionsByQuestion.get(question.id) ?? [],
    attemptCount: attemptCounts.get(question.id) ?? 0,
  }));

  const examByModuleId = new Map(exams.map((exam) => [exam.module_id, exam]));
  const questionsByModuleId = new Map<number, AdminExamQuestion[]>();
  for (const question of questions) {
    const list = questionsByModuleId.get(question.module_id) ?? [];
    list.push(question);
    questionsByModuleId.set(question.module_id, list);
  }

  return {
    modules: modules.map((module) => {
      const moduleQuestions = questionsByModuleId.get(module.id) ?? [];
      const activeQuestions = moduleQuestions.filter((question) => question.is_active);
      const validActiveQuestionCount = activeQuestions.filter((question) => {
        const correctCount = question.options.filter((option) => option.is_correct).length;
        return question.options.length >= 2 && correctCount === 1;
      }).length;

      return {
        module,
        exam: examByModuleId.get(module.id) ?? null,
        activeQuestionCount: activeQuestions.length,
        validActiveQuestionCount,
        totalQuestionCount: moduleQuestions.length,
      };
    }),
    questions,
  };
}

async function ensureExamForModule(module: Module): Promise<Exam | null> {
  const db = await createClient();
  const { data: existing } = await db
    .from("exams")
    .select("*")
    .eq("module_id", module.id)
    .maybeSingle();

  if (existing) return existing as Exam;

  const { data, error } = await db
    .from("exams")
    .insert({
      module_id: module.id,
      title: `${module.title} toets`,
      description: "Beantwoord 10 willekeurige vragen om deze module af te ronden.",
      passing_score: 70,
      is_published: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("ensureExamForModule", error.message);
    return null;
  }

  return data as Exam;
}

async function getModuleForAdmin(moduleId: number): Promise<Module | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("modules")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Module;
}

async function nextQuestionOrderIndex(examId: number): Promise<number> {
  const db = await createClient();
  const { data } = await db
    .from("exam_questions")
    .select("order_index")
    .eq("exam_id", examId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as { order_index?: number } | null)?.order_index ?? 0) + 1;
}

async function insertQuestionWithOptions(
  input: AdminExamQuestionInput,
  module: Module,
  exam: Exam,
  actorStudentId: string
): Promise<{ questionId: number | null; error: string | null }> {
  const db = await createClient();
  const options = normalizeOptions(input.options);
  const correctOption = options.find((option) => option.isCorrect);
  if (!correctOption) return { questionId: null, error: "Choose a correct answer." };

  const { data: question, error: questionError } = await db
    .from("exam_questions")
    .insert({
      exam_id: exam.id,
      module_id: module.id,
      question: input.questionText.trim(),
      question_text: input.questionText.trim(),
      explanation: input.explanation?.trim() || null,
      options: options.map((option) => option.optionText),
      correct_answer: correctOption.optionText,
      order_index: await nextQuestionOrderIndex(exam.id),
      is_active: input.isActive,
      created_by: actorStudentId,
      updated_by: actorStudentId,
    })
    .select("id")
    .single();

  if (questionError || !question) {
    return { questionId: null, error: questionError?.message ?? "Could not save question." };
  }

  const rows = options.map((option, index) => ({
    question_id: (question as { id: number }).id,
    option_text: option.optionText,
    is_correct: option.isCorrect,
    order_index: index + 1,
  }));
  const { error: optionsError } = await db.from("exam_answer_options").insert(rows);

  if (optionsError) {
    return { questionId: null, error: optionsError.message };
  }

  return { questionId: (question as { id: number }).id, error: null };
}

export async function saveExamQuestionAdmin(
  input: AdminExamQuestionInput,
  actorStudentId: string
): Promise<{ questionId: number | null; error: string | null }> {
  await requireAdmin();

  const validationError = validateAdminExamQuestionInput(input);
  if (validationError) return { questionId: null, error: validationError };

  if (process.env.NODE_ENV === "test") {
    return { questionId: input.id ?? 1, error: null };
  }

  const moduleRow = await getModuleForAdmin(input.moduleId);
  if (!moduleRow) return { questionId: null, error: "Module not found." };

  const exam = await ensureExamForModule(moduleRow);
  if (!exam) return { questionId: null, error: "Could not create or find exam." };

  if (!input.id) {
    return insertQuestionWithOptions(input, moduleRow, exam, actorStudentId);
  }

  const db = await createClient();
  const { count: attemptCount, error: attemptCountError } = await db
    .from("exam_attempt_questions")
    .select("*", { count: "exact", head: true })
    .eq("question_id", input.id);

  if (attemptCountError) {
    return { questionId: null, error: attemptCountError.message };
  }

  if ((attemptCount ?? 0) > 0) {
    await db
      .from("exam_questions")
      .update({
        is_active: false,
        updated_by: actorStudentId,
      })
      .eq("id", input.id);
    return insertQuestionWithOptions(input, moduleRow, exam, actorStudentId);
  }

  const options = normalizeOptions(input.options);
  const correctOption = options.find((option) => option.isCorrect);
  if (!correctOption) return { questionId: null, error: "Choose a correct answer." };

  const { error: questionError } = await db
    .from("exam_questions")
    .update({
      module_id: moduleRow.id,
      exam_id: exam.id,
      question: input.questionText.trim(),
      question_text: input.questionText.trim(),
      explanation: input.explanation?.trim() || null,
      options: options.map((option) => option.optionText),
      correct_answer: correctOption.optionText,
      is_active: input.isActive,
      updated_by: actorStudentId,
    })
    .eq("id", input.id);

  if (questionError) return { questionId: null, error: questionError.message };

  const { error: deleteError } = await db
    .from("exam_answer_options")
    .delete()
    .eq("question_id", input.id);

  if (deleteError) return { questionId: null, error: deleteError.message };

  const { error: optionsError } = await db.from("exam_answer_options").insert(
    options.map((option, index) => ({
      question_id: input.id,
      option_text: option.optionText,
      is_correct: option.isCorrect,
      order_index: index + 1,
    }))
  );

  if (optionsError) return { questionId: null, error: optionsError.message };
  return { questionId: input.id, error: null };
}

export async function setExamQuestionActiveAdmin(
  questionId: number,
  isActive: boolean,
  actorStudentId: string
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db
    .from("exam_questions")
    .update({
      is_active: isActive,
      updated_by: actorStudentId,
    })
    .eq("id", questionId);

  return { error: error?.message ?? null };
}

export async function archiveExamQuestionAdmin(
  questionId: number,
  actorStudentId: string
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db
    .from("exam_questions")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_by: actorStudentId,
    })
    .eq("id", questionId);

  return { error: error?.message ?? null };
}
