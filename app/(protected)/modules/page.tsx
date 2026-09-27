import Link from "next/link";
import { ensureCurrentStudent } from "@/lib/students";
import { getPublishedModules } from "@/lib/modules";
import { getLessonCountsByModuleIds, getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getProgressByLessonIds } from "@/lib/progress";
import { buildModuleAccessMap, getLegacyAcademyModuleIds } from "@/lib/module-gate";
import { FULL_COURSE_ACCESS_LEVEL, FREE_ACCESS_MODULE_LIMIT } from "@/lib/module-access-policy";
import { getExamsByModuleIds, getPassedExamIdsForStudent } from "@/lib/exams";
import { PageHeader } from "@/components/layout/PageHeader";
import { ModuleStateBadge } from "@/components/StatusBadge";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { asText } from "@/lib/as-text";
import { stripModulePrefix } from "@/lib/module-title";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";

export default async function ModulesPage() {
  const [{ student }, modules] = await Promise.all([
    ensureCurrentStudent(),
    getPublishedModules(),
  ]);
  const moduleIds = modules.map((module) => module.id);

  const [lessonCountMap, examMap, onboarding, legacyAccessModuleIds] = await Promise.all([
    getLessonCountsByModuleIds(moduleIds),
    getExamsByModuleIds(moduleIds),
    student ? getStudentOnboardingResponse(student.id) : Promise.resolve(null),
    student ? getLegacyAcademyModuleIds(student.id) : Promise.resolve(new Set<number>()),
  ]);
  const intakeComplete = onboardingIsComplete(onboarding);
  const needsIntake = !!student && !intakeComplete && student.access_level < FULL_COURSE_ACCESS_LEVEL;

  const passedExamIds = student
    ? await getPassedExamIdsForStudent(
        student.id,
        [...examMap.values()].map((exam) => exam.id)
      )
    : new Set<number>();
  const moduleAccessMap = student
    ? buildModuleAccessMap(
        modules,
        onboarding,
        student.access_level,
        legacyAccessModuleIds
      )
    : new Map<number, boolean>();

  const orderedModules = [...modules].sort((a, b) => a.order_index - b.order_index);
  const firstLesson = needsIntake && orderedModules[0]
    ? (await getPublishedLessonsByModuleId(orderedModules[0].id))[0]
    : null;
  const firstLessonProgress = firstLesson && student
    ? await getProgressByLessonIds(student.id, [firstLesson.id])
    : null;
  const introCompleted = firstLesson
    ? firstLessonProgress?.get(firstLesson.id)?.watched === true
    : false;

  const moduleStateMap = new Map<number, "locked" | "available" | "completed">();
  for (const mod of orderedModules) {
    const canAccess = moduleAccessMap.get(mod.id) === true;
    if (!canAccess) {
      moduleStateMap.set(mod.id, "locked");
      continue;
    }

    const exam = examMap.get(mod.id);
    moduleStateMap.set(
      mod.id,
      exam && passedExamIds.has(exam.id) ? "completed" : "available"
    );
  }

  const main =
    orderedModules.length === 0 ? (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 text-center">
        <p className="cb-caption">Er zijn nog geen modules beschikbaar.</p>
      </div>
    ) : (
      <div className="space-y-5">
        {needsIntake && (
          <section className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_8%,var(--card))] p-5 sm:p-6">
            <h2 className="cb-section-title">
              {legacyAccessModuleIds.size > 0
                ? "Maak je intake af"
                : introCompleted ? "Ga verder na je eerste les" : "Begin met de eerste les"}
            </h2>
            <p className="mt-2 cb-caption max-w-2xl">
              {legacyAccessModuleIds.size > 0
                ? "Je eerder geopende modules blijven beschikbaar. Vul je intake in om ook de overige gratis modules te openen en je mentor context te geven."
                : introCompleted
                ? "Vul nu je intake in om de overige lessen te openen en je mentor context te geven."
                : "Maak eerst kennis met het traject. Vul daarna je intake in om verder te leren en je mentor context te geven."}
            </p>
            <Link href={introCompleted || legacyAccessModuleIds.size > 0 ? "/onboarding" : `/modules/${orderedModules[0].slug}`} className="mt-5 inline-flex cb-btn cb-btn-primary">
              {introCompleted || legacyAccessModuleIds.size > 0 ? "Intake invullen" : "Open de eerste module"}
            </Link>
          </section>
        )}
        <ul className="grid gap-5 md:grid-cols-2">
          {orderedModules.map((mod, index) => {
            const state = moduleStateMap.get(mod.id) ?? "locked";
            const canOpen = state === "available" || state === "completed";
            const lessonCount = lessonCountMap.get(mod.id) ?? 0;
            const shortDesc = asText(mod.short_description);
            const moduleTitle = stripModulePrefix(mod.title, mod.order_index);
            const isPaidModule = student && student.access_level < FULL_COURSE_ACCESS_LEVEL && index >= FREE_ACCESS_MODULE_LIMIT;
            const lockedCopy = isPaidModule
              ? "Volledige Academy-toegang nodig"
              : needsIntake
                ? "Vul je intake in na de eerste les"
                : "Nog niet beschikbaar";
            const showLessonCount = (!needsIntake && !isPaidModule) || legacyAccessModuleIds.has(mod.id);
            return (
              <li key={mod.id}>
                {canOpen ? (
                  <Link
                    href={`/modules/${mod.slug}`}
                    className="group block h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[color-mix(in_oklab,var(--foreground)_28%,var(--border)_72%)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_22%,transparent)]"
                  >
                    <CourseThumbnail
                      src={mod.thumbnail_url}
                      title={moduleTitle}
                      eyebrow={`Module ${mod.order_index}`}
                      moduleNumber={mod.order_index}
                      priority={index < 2}
                      className="aspect-[16/10] w-full"
                      imageClassName="group-hover:scale-[1.035]"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                    <div className="flex min-h-[156px] flex-col p-5 sm:p-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <ModuleStateBadge state={state} />
                          {showLessonCount && <span className="cb-caption">
                            {lessonCount} {lessonCount === 1 ? "les" : "lessen"}
                          </span>}
                      </div>
                      <h2 className="mt-2 text-lg font-semibold leading-snug text-[var(--foreground)]">
                        {moduleTitle}
                      </h2>
                      {shortDesc && (
                        <p className="cb-caption mt-1 line-clamp-2">
                          {shortDesc}
                        </p>
                      )}
                    </div>
                    <div className="mt-5 text-sm font-semibold text-[var(--foreground)]">
                      {needsIntake && !legacyAccessModuleIds.has(mod.id) ? "Eerste les bekijken" : "Openen"}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] opacity-70">
                    <CourseThumbnail
                      src={mod.thumbnail_url}
                      title={moduleTitle}
                      eyebrow={`Module ${mod.order_index}`}
                      moduleNumber={mod.order_index}
                      priority={index < 2}
                      className="aspect-[16/10] w-full"
                      muted
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                    <div className="flex min-h-[156px] flex-col p-5 sm:p-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <ModuleStateBadge state={state} />
                          {showLessonCount && <span className="cb-caption">
                            {lessonCount} {lessonCount === 1 ? "les" : "lessen"}
                          </span>}
                      </div>
                      <h2 className="mt-2 text-lg font-semibold leading-snug text-[var(--foreground)]">
                        {moduleTitle}
                      </h2>
                      {shortDesc && (
                        <p className="cb-caption mt-1 line-clamp-2">
                          {shortDesc}
                        </p>
                      )}
                    </div>
                    <div className="mt-5 text-sm">
                      <span className="cb-caption">{lockedCopy}</span>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Academy" }]}
        eyebrow="Jouw opleiding"
        title="Modules"
        description="Volg de lessen in je eigen tempo. De eerste drie modules zijn gratis; voor de rest heb je volledige Academy-toegang nodig."
      />
      <div className="min-w-0">{main}</div>
    </div>
  );
}
