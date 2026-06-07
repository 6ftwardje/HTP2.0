/**
 * Admin module — server-side helpers and types.
 * DB access uses the cookie Supabase client + RLS (`is_platform_admin()`); `requireAdmin()` gates routes/actions.
 */

export * from "@/lib/admin/access";
export * from "@/lib/admin/types";
export { logAdminAction, formatActorLabel } from "@/lib/admin/audit";
export {
  listStudentsAdmin,
  getStudentByIdAdmin,
  getAdminStudentDetail,
  updateStudentAccessLevelAdmin,
} from "@/lib/admin/students";
export {
  buildAdminStudentProgressDetail,
  markStudentModuleComplete,
  resetStudentModuleLessonProgress,
  resetStudentAllLessonProgress,
  markStudentAcademyLessonsComplete,
} from "@/lib/admin/progress";
export { getExamSummariesByModuleForStudent } from "@/lib/admin/exams";
export {
  createLessonAdmin,
  createModuleAdmin,
  deleteEmptyModuleAdmin,
  deleteLessonAdmin,
  listModuleVideoBlocksAdmin,
  listLessonsForVideoAdmin,
  listModulesForVideoAdmin,
  getLessonForVideoAdmin,
  updateLessonContentAdmin,
  updateLessonVideoAdmin,
  updateModuleAdmin,
} from "@/lib/admin/videos";
