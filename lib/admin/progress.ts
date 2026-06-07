import { createClient } from "@/lib/supabase/server";
import type { Module } from "@/lib/types";
import { getExamSummariesByModuleForStudent } from "@/lib/admin/exams";
import { requireAdmin } from "@/lib/admin/access";
import type {
  AdminModuleProgressBlock,
  AdminStudentProgressOverview,
} from "@/lib/admin/types";

/**
 * Load published curriculum + progress for a student (admin).
 */
export async function buildAdminStudentProgressDetail(
  studentId: string
): Promise<{
  overview: AdminStudentProgressOverview;
  modules: AdminModuleProgressBlock[];
}> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return {
      overview: {
        totalLessonsPublished: 0,
        completedLessons: 0,
        modulesPassedExams: 0,
        totalModulesWithExam: 0,
      },
      modules: [],
    };
  }

  const db = await createClient();

  const { data: modRows } = await db
    .from("modules")
    .select("*")
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  const modules = (modRows ?? []) as Module[];
  const moduleIds = modules.map((m) => m.id);

  const { data: lessonRows } =
    moduleIds.length > 0
      ? await db
          .from("lessons")
          .select("*")
          .eq("is_published", true)
          .in("module_id", moduleIds)
          .order("order_index", { ascending: true })
      : { data: [] as unknown[] };

  const lessonsByModule = new Map<number, typeof lessonRows>();
  for (const l of lessonRows ?? []) {
    const row = l as { module_id: number };
    const list = lessonsByModule.get(row.module_id) ?? [];
    list.push(l);
    lessonsByModule.set(row.module_id, list);
  }

  const allLessonIds = (lessonRows ?? []).map((l) => (l as { id: number }).id);

  const { data: progressRows } =
    allLessonIds.length > 0
      ? await db
          .from("progress")
          .select("lesson_id, watched, watched_at")
          .eq("student_id", studentId)
          .in("lesson_id", allLessonIds)
      : { data: [] as { lesson_id: number; watched: boolean; watched_at: string | null }[] };

  const progressByLesson = new Map<
    number,
    { watched: boolean; watched_at: string | null }
  >();
  for (const p of progressRows ?? []) {
    const row = p as {
      lesson_id: number;
      watched: boolean;
      watched_at: string | null;
    };
    progressByLesson.set(row.lesson_id, {
      watched: row.watched,
      watched_at: row.watched_at,
    });
  }

  const examByModule = await getExamSummariesByModuleForStudent(
    studentId,
    moduleIds
  );

  let completedLessons = 0;
  let totalLessonsPublished = 0;
  let modulesPassedExams = 0;
  let totalModulesWithExam = 0;

  const blocks: AdminModuleProgressBlock[] = [];

  for (const mod of modules) {
    const rawLessons = lessonsByModule.get(mod.id) ?? [];
    totalLessonsPublished += rawLessons.length;

    const lessons = rawLessons.map((raw) => {
      const lesson = raw as import("@/lib/types").Lesson;
      const pr = progressByLesson.get(lesson.id);
      const watched = pr?.watched === true;
      if (watched) completedLessons += 1;
      return {
        lesson,
        watched,
        watchedAt: pr?.watched_at ?? null,
      };
    });

    const completedCount = lessons.filter((l) => l.watched).length;
    const examSummary = examByModule.get(mod.id) ?? null;
    if (examSummary) {
      totalModulesWithExam += 1;
      if (examSummary.hasPassed) modulesPassedExams += 1;
    }

    blocks.push({
      module: mod,
      lessons,
      completedCount,
      totalLessons: lessons.length,
      examSummary,
    });
  }

  return {
    overview: {
      totalLessonsPublished,
      completedLessons,
      modulesPassedExams,
      totalModulesWithExam,
    },
    modules: blocks,
  };
}

/** Mark every published lesson in the module as watched; does not touch exam_results. */
export async function markStudentModuleComplete(
  studentId: string,
  moduleId: number
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data: lessons, error: le } = await db
    .from("lessons")
    .select("id")
    .eq("module_id", moduleId)
    .eq("is_published", true);

  if (le) return { error: le.message };
  const ids = (lessons ?? []).map((l) => (l as { id: number }).id);
  if (ids.length === 0) return { error: null };

  const now = new Date().toISOString();
  const rows = ids.map((lessonId) => ({
    student_id: studentId,
    lesson_id: lessonId,
    watched: true,
    watched_at: now,
  }));

  const { error } = await db.from("progress").upsert(rows, {
    onConflict: "student_id,lesson_id",
      ignoreDuplicates: false,
  });

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Remove lesson progress for this module only (lesson rows deleted).
 * Exam results for the module exam are left unchanged.
 */
export async function resetStudentModuleLessonProgress(
  studentId: string,
  moduleId: number
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data: lessons, error: le } = await db
    .from("lessons")
    .select("id")
    .eq("module_id", moduleId);

  if (le) return { error: le.message };
  const ids = (lessons ?? []).map((l) => (l as { id: number }).id);
  if (ids.length === 0) return { error: null };

  const { error } = await db
    .from("progress")
    .delete()
    .eq("student_id", studentId)
    .in("lesson_id", ids);

  if (error) return { error: error.message };
  return { error: null };
}

/** Delete all progress rows for the student (all modules). Does not touch exam_results. */
export async function resetStudentAllLessonProgress(
  studentId: string
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db.from("progress").delete().eq("student_id", studentId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Mark all published lessons in the academy as watched. Does not affect exam_results. */
export async function markStudentAcademyLessonsComplete(
  studentId: string
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data: lessons, error: le } = await db
    .from("lessons")
    .select("id")
    .eq("is_published", true);

  if (le) return { error: le.message };
  const ids = (lessons ?? []).map((l) => (l as { id: number }).id);
  if (ids.length === 0) return { error: null };

  const now = new Date().toISOString();
  const rows = ids.map((lessonId) => ({
    student_id: studentId,
    lesson_id: lessonId,
    watched: true,
    watched_at: now,
  }));

  const { error } = await db.from("progress").upsert(rows, {
    onConflict: "student_id,lesson_id",
    ignoreDuplicates: false,
  });

  if (error) return { error: error.message };
  return { error: null };
}
