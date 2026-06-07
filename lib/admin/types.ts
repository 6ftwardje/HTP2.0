import type {
  Exam,
  ExamResult,
  Lesson,
  Module,
  Student,
  StudentMentorNote,
  StudentOnboardingResponse,
} from "@/lib/types";

export type AdminSortField = "created_at" | "access_level" | "email";

export type AdminStudentListRow = Pick<
  Student,
  | "id"
  | "email"
  | "name"
  | "phone"
  | "access_level"
  | "mentor_status"
  | "tags"
  | "created_at"
  | "last_seen"
>;

export type AdminLessonProgressRow = {
  lesson: Lesson;
  watched: boolean;
  watchedAt: string | null;
};

export type AdminExamAttemptSummary = {
  exam: Exam;
  latestResult: Pick<ExamResult, "score" | "passed" | "submitted_at"> | null;
  attemptCount: number;
  hasPassed: boolean;
};

export type AdminModuleProgressBlock = {
  module: Module;
  lessons: AdminLessonProgressRow[];
  completedCount: number;
  totalLessons: number;
  examSummary: AdminExamAttemptSummary | null;
};

export type AdminStudentProgressOverview = {
  totalLessonsPublished: number;
  completedLessons: number;
  modulesPassedExams: number;
  totalModulesWithExam: number;
};

export type AdminStudentDetail = {
  student: Student;
  progressOverview: AdminStudentProgressOverview;
  modules: AdminModuleProgressBlock[];
  onboarding: StudentOnboardingResponse | null;
  mentorNotes: StudentMentorNote[];
};
