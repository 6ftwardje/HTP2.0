import Link from "next/link";
import { ensureCurrentStudent } from "@/lib/students";
import { getPublishedModules } from "@/lib/modules";
import { getLessonCountsByModuleIds } from "@/lib/lessons";
import { getModuleAccessMap } from "@/lib/module-gate";
import { getExamsByModuleIds, getPassedExamIdsForStudent } from "@/lib/exams";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { RightRailCard } from "@/components/layout/RightRailCard";
import { ModuleStateBadge } from "@/components/StatusBadge";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { asText } from "@/lib/as-text";

export default async function ModulesPage() {
  const { student } = await ensureCurrentStudent();
  const modules = await getPublishedModules();
  const moduleIds = modules.map((module) => module.id);

  const [lessonCountMap, moduleAccessMap, examMap] = await Promise.all([
    getLessonCountsByModuleIds(moduleIds),
    student
      ? getModuleAccessMap(student.id, modules)
      : Promise.resolve(new Map<number, boolean>()),
    getExamsByModuleIds(moduleIds),
  ]);

  const passedExamIds = student
    ? await getPassedExamIdsForStudent(
        student.id,
        [...examMap.values()].map((exam) => exam.id)
      )
    : new Set<number>();

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

  const rail = (
    <>
      <RightRailCard title="Zo werkt het">
        <p className="cb-body text-sm leading-relaxed">
          Elke module is een helder trainingsblok. Rond de lessen in volgorde af
          en slaag voor de toets om het volgende blok vrij te spelen.
        </p>
      </RightRailCard>
      <RightRailCard title="Focus">
        <p className="cb-caption leading-relaxed">
          Werk aan één blok tegelijk. Neem de tijd om de inhoud toe te passen.
        </p>
      </RightRailCard>
    </>
  );

  const main =
    orderedModules.length === 0 ? (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 text-center">
        <p className="cb-caption">Er zijn nog geen modules beschikbaar.</p>
      </div>
    ) : (
      <ul className="grid gap-5 md:grid-cols-2">
          {orderedModules.map((mod) => {
            const state = moduleStateMap.get(mod.id) ?? "locked";
            const canOpen = state === "available" || state === "completed";
            const lessonCount = lessonCountMap.get(mod.id) ?? 0;
            const shortDesc = asText(mod.short_description);
            return (
            <li key={mod.id}>
              {canOpen ? (
                <Link
                  href={`/modules/${mod.slug}`}
                  className="group block h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[color-mix(in_oklab,var(--foreground)_28%,var(--border)_72%)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_22%,transparent)]"
                >
                  <CourseThumbnail
                    src={mod.thumbnail_url}
                    title={mod.title}
                    eyebrow={`Module ${mod.order_index}`}
                    className="aspect-[16/10] w-full"
                    imageClassName="group-hover:scale-[1.035]"
                  />
                  <div className="flex min-h-[190px] flex-col p-5 sm:p-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <ModuleStateBadge state={state} />
                        <span className="cb-caption">
                          {lessonCount} {lessonCount === 1 ? "les" : "lessen"}
                        </span>
                      </div>
                      <h2 className="mt-2 text-lg font-semibold leading-snug text-[var(--foreground)]">
                        {mod.title}
                      </h2>
                        {shortDesc && (
                          <p className="cb-caption mt-1 line-clamp-2">
                            {shortDesc}
                          </p>
                        )}
                      </div>
                      <div className="mt-5 text-sm font-semibold text-[var(--foreground)]">
                        Openen
                      </div>
                  </div>
                </Link>
              ) : (
                <div className="h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] opacity-70">
                  <CourseThumbnail
                    src={mod.thumbnail_url}
                    title={mod.title}
                    eyebrow={`Module ${mod.order_index}`}
                    className="aspect-[16/10] w-full"
                    muted
                  />
                  <div className="flex min-h-[190px] flex-col p-5 sm:p-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <ModuleStateBadge state={state} />
                        <span className="cb-caption">
                          {lessonCount} {lessonCount === 1 ? "les" : "lessen"}
                        </span>
                      </div>
                      <h2 className="mt-2 text-lg font-semibold leading-snug text-[var(--foreground)]">
                        {mod.title}
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
    );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Academy" }]}
        eyebrow="Jouw opleiding"
        title="Modules"
        description="Werk in volgorde. Rond de lessen en toets af om het volgende blok vrij te spelen."
      />
      <AppPageLayout main={main} rail={rail} />
    </div>
  );
}
