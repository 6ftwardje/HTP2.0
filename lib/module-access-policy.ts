/** Keep these entitlements in sync with the lesson and exam policies in Supabase. */
export const FULL_COURSE_ACCESS_LEVEL = 2;

type OrderedModule = { id: number; order_index: number; is_free: boolean };

/** Full module access excludes the first lesson's standalone preview. */
export function canOpenModuleWithIntake(params: {
  accessLevel: number;
  intakeComplete: boolean;
  isFreeModule: boolean;
  hasLegacyModuleAccess?: boolean;
}): boolean {
  return (
    params.accessLevel >= FULL_COURSE_ACCESS_LEVEL ||
    params.hasLegacyModuleAccess === true ||
    (params.intakeComplete && params.isFreeModule)
  );
}

export function buildModuleEntitlementMap(
  modules: OrderedModule[],
  intakeComplete: boolean,
  accessLevel: number,
  legacyAccessModuleIds: ReadonlySet<number> = new Set<number>()
): Map<number, boolean> {
  const ordered = [...modules].sort(
    (a, b) => a.order_index - b.order_index || a.id - b.id
  );
  return new Map(
    ordered.map((module, index) => [
      module.id,
      canOpenModuleWithIntake({
        accessLevel,
        intakeComplete,
        isFreeModule: module.is_free,
        hasLegacyModuleAccess: legacyAccessModuleIds.has(module.id),
      }) ||
        index === 0,
    ])
  );
}

/** A new free student can experience the first lesson before sharing mentor context. */
export function canOpenLessonWithIntake(params: {
  accessLevel: number;
  intakeComplete: boolean;
  isFreeModule: boolean;
  isFirstModule: boolean;
  isFirstLesson: boolean;
  hasLegacyModuleAccess?: boolean;
}): boolean {
  return (
    canOpenModuleWithIntake(params) ||
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
  legacyAccessModuleIds: ReadonlySet<number>,
  previewOnlyModuleIds: ReadonlySet<number> = new Set<number>()
): T | null {
  const available = summaries.filter((summary) =>
    summary.state === "available" &&
    !(previewOnlyModuleIds.has(summary.module.id) && summary.completedLessons > 0)
  );
  return (
    (incompleteFreeIntake
      ? available.find((summary) =>
          legacyAccessModuleIds.has(summary.module.id)
        )
      : null) ??
    available.find((summary) =>
      summary.completedLessons > 0
    ) ??
    available[0] ?? null
  );
}
