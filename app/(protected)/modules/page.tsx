import Link from "next/link";
import { ensureCurrentStudent } from "@/lib/students";
import { getPublishedModules } from "@/lib/modules";
import { getLessonCountsByModuleIds } from "@/lib/lessons";
import { buildModuleAccessMap } from "@/lib/module-gate";
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

  const [lessonCountMap, examMap, onboarding] = await Promise.all([
    getLessonCountsByModuleIds(moduleIds),
    getExamsByModuleIds(moduleIds),
    student ? getStudentOnboardingResponse(student.id) : Promise.resolve(null),
  ]);
  const intakeComplete = onboardingIsComplete(onboarding);

  const passedExamIds = student
    ? await getPassedExamIdsForStudent(
        student.id,
        [...examMap.values()].map((exam) => exam.id)
      )
    : new Set<number>();
  const examIdByModuleId = new Map(
    [...examMap.values()].map((exam) => [exam.module_id, exam.id])
  );
  const moduleAccessMap = student
    ? buildModuleAccessMap(modules, onboarding, passedExamIds, examIdByModuleId)
    : new Map<number, boolean>();

  const orderedModules = [...modules].sort((a, b) => a.order_index - b.order_index);

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
        {!intakeComplete && (
          <section className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_8%,var(--card))] p-5 sm:p-6">
            <div className="cb-eyebrow text-[var(--accent)]">Intake vereist</div>
            <h2 className="mt-3 cb-section-title">
              Vul je intake in om videolessen te starten
            </h2>
            <p className="mt-2 cb-caption max-w-2xl">
              Je kunt de modules alvast bekijken. De videocourse opent zodra je
              jouw ervaring, doelen en huidige uitdaging hebt ingevuld.
            </p>
            <Link href="/onboarding" className="mt-5 inline-flex cb-btn cb-btn-primary">
              Intake invullen
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
                          <span className="cb-caption">
                          {lessonCount} {lessonCount === 1 ? "les" : "lessen"}
                        </span>
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
                      {intakeComplete ? "Openen" : "Module bekijken"}
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
                          <span className="cb-caption">
                          {lessonCount} {lessonCount === 1 ? "les" : "lessen"}
                        </span>
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
                      <span className="cb-caption">Komt vrij na de vorige toets</span>
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
        description="Werk in volgorde. Rond de lessen en toets af om het volgende blok vrij te spelen."
      />
      <div className="min-w-0">{main}</div>
    </div>
  );
}
