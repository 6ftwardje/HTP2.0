/** Keep these entitlements in sync with the lesson and exam policies in Supabase. */
export const FREE_ACCESS_MODULE_LIMIT = 3;
export const FULL_COURSE_ACCESS_LEVEL = 2;

type OrderedModule = { id: number; order_index: number };

export function buildModuleEntitlementMap(
  modules: OrderedModule[],
  intakeComplete: boolean,
  accessLevel: number,
  legacyAccessModuleIds: ReadonlySet<number> = new Set<number>()
): Map<number, boolean> {
  const ordered = [...modules].sort(
    (a, b) => a.order_index - b.order_index || a.id - b.id
  );
  const hasFullCourseAccess = accessLevel >= FULL_COURSE_ACCESS_LEVEL;

  return new Map(
    ordered.map((module, index) => [
      module.id,
      hasFullCourseAccess ||
        legacyAccessModuleIds.has(module.id) ||
        (intakeComplete && index < FREE_ACCESS_MODULE_LIMIT) ||
        index === 0,
    ])
  );
}

/** A new free student can experience the first lesson before sharing mentor context. */
export function canOpenLessonWithIntake(params: {
  accessLevel: number;
  intakeComplete: boolean;
  isFirstModule: boolean;
  isFirstLesson: boolean;
  hasLegacyModuleAccess?: boolean;
}): boolean {
  return (
    params.accessLevel >= FULL_COURSE_ACCESS_LEVEL ||
    params.hasLegacyModuleAccess === true ||
    params.intakeComplete ||
    (params.isFirstModule && params.isFirstLesson)
  );
}

/** A returning learner should resume visible progress, not restart at module one. */
export function chooseNextAvailableModule<T extends {
  module: { id: number };
  state: string;
  completedLessons: number;
}>(
  summaries: T[],
  incompleteFreeIntake: boolean,
  legacyAccessModuleIds: ReadonlySet<number>
): T | null {
  return (
    (incompleteFreeIntake
      ? summaries.find((summary) =>
          summary.state === "available" && legacyAccessModuleIds.has(summary.module.id)
        )
      : null) ??
    summaries.find((summary) =>
      summary.state === "available" && summary.completedLessons > 0
    ) ??
    summaries.find((summary) => summary.state === "available") ?? null
  );
}
