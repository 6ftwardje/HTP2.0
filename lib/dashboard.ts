import { createClient } from "@/lib/supabase/server";
import { getExamsByModuleIds, getPassedExamIdsForStudent } from "@/lib/exams";
import { getLessonActionProgress, normalizeLessonActions } from "@/lib/lesson-actions";
import { getPublishedLessonsByModuleIds } from "@/lib/lessons";
import { buildModuleAccessMap } from "@/lib/module-gate";
import { getPublishedModules } from "@/lib/modules";
import { getStudentOnboardingResponse } from "@/lib/onboarding";
import { getProgressByLessonIds } from "@/lib/progress";
import type { DashboardStats, Exam, Lesson, Module } from "@/lib/types";

export type DashboardModuleState = "locked" | "available" | "completed";

export type DashboardModuleSummary = {
  module: Module;
  state: DashboardModuleState;
  completedLessons: number;
  totalLessons: number;
};

export type DashboardNextStep =
  | {
      type: "lesson";
      href: string;
      label: string;
      lesson: Lesson;
      module: Module;
      completedLessons: number;
      totalLessons: number;
      actions: string[];
      actionProgress: Map<number, boolean>;
    }
  | {
      type: "exam";
      href: string;
      label: string;
      module: Module;
      exam: Exam;
      completedLessons: number;
      totalLessons: number;
    }
  | {
      type: "module";
      href: string;
      label: string;
      module: Module;
      completedLessons: number;
      totalLessons: number;
    }
  | {
      type: "completed";
      href: string;
      label: string;
      module: Module | null;
      completedLessons: number;
      totalLessons: number;
    };

export type DashboardOverview = {
  nextStep: DashboardNextStep;
  modules: DashboardModuleSummary[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [modulesRes, lessonsRes] = await Promise.all([
    supabase.from("modules").select("id, is_published", { count: "exact" }),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
  ]);

  const totalModules = modulesRes.count ?? 0;
  const publishedModules =
    modulesRes.data?.filter((m) => m.is_published).length ?? 0;
  const totalLessons = lessonsRes.count ?? 0;

  return {
    totalModules,
    publishedModules,
    totalLessons,
  };
}

export async function getDashboardOverview(
  studentId: string,
  accessLevel = 1
): Promise<DashboardOverview> {
  const modules = await getPublishedModules();
  const orderedModules = [...modules].sort((a, b) => a.order_index - b.order_index);
  const moduleIds = orderedModules.map((module) => module.id);
  const [examMap, lessons, onboarding] = await Promise.all([
    getExamsByModuleIds(moduleIds),
    getPublishedLessonsByModuleIds(moduleIds),
    getStudentOnboardingResponse(studentId),
  ]);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [passedExamIds, progressMap] = await Promise.all([
    getPassedExamIdsForStudent(
      studentId,
      [...examMap.values()].map((exam) => exam.id)
    ),
    getProgressByLessonIds(studentId, lessonIds),
  ]);
  const examIdByModuleId = new Map(
    [...examMap.values()].map((exam) => [exam.module_id, exam.id])
  );
  const accessMap = buildModuleAccessMap(
    orderedModules,
    onboarding,
    passedExamIds,
    examIdByModuleId,
    accessLevel
  );

  const lessonsByModule = new Map<number, Lesson[]>();
  for (const lesson of lessons) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  const summaries = orderedModules.map((module) => {
    const moduleLessons = lessonsByModule.get(module.id) ?? [];
    const completedLessons = moduleLessons.filter(
      (lesson) => progressMap.get(lesson.id)?.watched === true
    ).length;
    const exam = examMap.get(module.id);
    const state: DashboardModuleState =
      accessMap.get(module.id) !== true
        ? "locked"
        : exam && passedExamIds.has(exam.id)
          ? "completed"
          : "available";

    return {
      module,
      state,
      completedLessons,
      totalLessons: moduleLessons.length,
    };
  });

  const currentSummary =
    summaries.find((summary) => summary.state === "available") ?? null;

  if (!currentSummary) {
    const completedLessons = summaries.reduce(
      (total, summary) => total + summary.completedLessons,
      0
    );
    const totalLessons = summaries.reduce(
      (total, summary) => total + summary.totalLessons,
      0
    );
    return {
      modules: summaries,
      nextStep: {
        type: "completed",
        href: "/modules",
        label: "Bekijk je traject",
        module: summaries.at(-1)?.module ?? null,
        completedLessons,
        totalLessons,
      },
    };
  }

  const currentModule = currentSummary.module;
  const currentLessons = lessonsByModule.get(currentModule.id) ?? [];
  const nextLesson =
    currentLessons.find(
      (lesson) => progressMap.get(lesson.id)?.watched !== true
    ) ?? null;

  if (nextLesson) {
    const actions = normalizeLessonActions(nextLesson.action_items);
    return {
      modules: summaries,
      nextStep: {
        type: "lesson",
        href: `/lessons/${nextLesson.slug}`,
        label:
          currentSummary.completedLessons === 0
            ? "Start met deze les"
            : "Ga verder met de les",
        lesson: nextLesson,
        module: currentModule,
        completedLessons: currentSummary.completedLessons,
        totalLessons: currentSummary.totalLessons,
        actions,
        actionProgress:
          actions.length > 0
            ? await getLessonActionProgress(studentId, nextLesson.id)
            : new Map<number, boolean>(),
      },
    };
  }

  const exam = examMap.get(currentModule.id);
  if (exam) {
    return {
      modules: summaries,
      nextStep: {
        type: "exam",
        href: `/modules/${currentModule.slug}/exam`,
        label: "Maak de toets",
        module: currentModule,
        exam,
        completedLessons: currentSummary.completedLessons,
        totalLessons: currentSummary.totalLessons,
      },
    };
  }

  return {
    modules: summaries,
    nextStep: {
      type: "module",
      href: `/modules/${currentModule.slug}`,
      label: "Bekijk de module",
      module: currentModule,
      completedLessons: currentSummary.completedLessons,
      totalLessons: currentSummary.totalLessons,
    },
  };
}
