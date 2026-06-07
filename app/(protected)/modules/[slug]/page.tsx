import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { getModuleBySlug } from "@/lib/modules";
import { getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getLessonStatuses, lessonsWithStatus } from "@/lib/lesson-gate";
import { getModuleAccessMap } from "@/lib/module-gate";
import { getExamByModuleId, hasPassedExam } from "@/lib/exams";
import { getPublishedModules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { RightRailCard } from "@/components/layout/RightRailCard";
import { ContentSection } from "@/components/layout/ContentSection";
import { LessonStatusBadge } from "@/components/StatusBadge";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { asText } from "@/lib/as-text";

type Props = { params: Promise<{ slug: string }> };

export default async function ModuleDetailPage({ params }: Props) {
  const { slug } = await params;
  const moduleData = await getModuleBySlug(slug);
  if (!moduleData) notFound();

  const { student } = await ensureCurrentStudent();
  if (!student) notFound();

  const [lessons, allModules, exam] = await Promise.all([
    getPublishedLessonsByModuleId(moduleData.id),
    getPublishedModules(),
    getExamByModuleId(moduleData.id),
  ]);

  const statusMap = await getLessonStatuses(student.id, lessons);
  const lessonsWithStatusList = lessonsWithStatus(lessons, statusMap);
  const moduleAccessMap = await getModuleAccessMap(student.id, allModules);
  const canAccessModule = moduleAccessMap.get(moduleData.id) === true;
  const hasPassedThisExam = exam
    ? await hasPassedExam(student.id, exam.id)
    : false;
  const allLessonsCompleted = lessons.every((l) => statusMap.get(l.id) === "completed");
  const examUnlocked = !!exam && allLessonsCompleted;

  const completedCount = lessons.filter(
    (l) => statusMap.get(l.id) === "completed"
  ).length;

  const moduleIntroText = asText(moduleData.description);

  if (!canAccessModule) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: "Academy", href: "/modules" },
            { label: "Module" },
          ]}
          eyebrow="Toegang"
          title="Deze module is nog vergrendeld"
          description="Slaag eerst voor de toets van de vorige module om dit blok vrij te spelen."
        />
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center sm:p-10">
          <Link href="/modules" className="cb-btn cb-btn-primary">
            Terug naar modules
          </Link>
        </div>
      </div>
    );
  }

  const rail = (
    <>
      <RightRailCard title="Module">
        <dl className="space-y-4">
          <div>
            <dt className="cb-caption">Positie</dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
              Blok {moduleData.order_index}
            </dd>
          </div>
          <div>
            <dt className="cb-caption">Lessen</dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
              {completedCount} / {lessons.length} afgerond
            </dd>
          </div>
          {exam && (
            <div>
              <dt className="cb-caption">Toets</dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {hasPassedThisExam
                  ? "Geslaagd"
                  : examUnlocked
                    ? "Klaar om te starten"
                    : "Komt vrij na de lessen"}
              </dd>
            </div>
          )}
        </dl>
      </RightRailCard>

      {exam && (
        <RightRailCard title="Volgende mijlpaal">
          <p className="cb-caption leading-relaxed">
            {hasPassedThisExam
              ? "Je bent geslaagd. Je kunt de toets altijd opnieuw maken."
              : examUnlocked
                ? "Alle lessen zijn afgerond. Start de toets wanneer je klaar bent."
                : "Rond elke les in dit blok af om de toets vrij te spelen."}
          </p>
          {examUnlocked ? (
            <Link
              href={`/modules/${moduleData.slug}/exam`}
              className="mt-5 inline-flex cb-btn cb-btn-primary w-full justify-center"
            >
              {hasPassedThisExam ? "Toets opnieuw maken" : "Start de toets"}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="mt-5 w-full cb-btn cb-btn-secondary cursor-not-allowed opacity-60"
            >
              Toets vergrendeld
            </button>
          )}
        </RightRailCard>
      )}
    </>
  );

  const main = (
    <>
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <CourseThumbnail
          src={moduleData.thumbnail_url}
          title={moduleData.title}
          eyebrow={`Module ${moduleData.order_index}`}
          className="aspect-[16/8] w-full sm:aspect-[21/9]"
        />
        <div className="p-5 sm:p-6 lg:p-8">
          <div className="cb-eyebrow">Over deze module</div>
          {moduleIntroText ? (
            <p className="mt-4 cb-body max-w-3xl">{moduleIntroText}</p>
          ) : (
            <p className="mt-4 cb-caption">
              Werk de lessen hieronder in volgorde af. Daarna komt de volgende
              stap vrij.
            </p>
          )}
        </div>
      </section>

      <ContentSection
        eyebrow="Lessen"
        title="Inhoud van deze module"
        description="Werk in volgorde. Je voortgang wordt automatisch bijgewerkt."
      >
        {lessons.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="cb-caption">Deze module bevat nog geen lessen.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {lessonsWithStatusList.map((lesson) => {
              const isLocked = lesson.status === "locked";
              const lessonDesc = asText(lesson.description);
              return (
                <li key={lesson.id} className={isLocked ? "opacity-55" : ""}>
                  {isLocked ? (
                    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--muted)_12%)]">
                      <div className="grid gap-0 sm:grid-cols-[220px_minmax(0,1fr)]">
                        <CourseThumbnail
                          src={lesson.thumbnail_url}
                          title={lesson.title}
                          eyebrow={`${lesson.order_index}`}
                          className="aspect-[16/9] w-full sm:aspect-auto sm:h-full sm:min-h-[150px]"
                          muted
                        />
                        <div className="min-w-0 p-4 sm:p-5">
                            <h3 className="font-semibold leading-snug text-[var(--muted)]">
                              {lesson.title}
                            </h3>
                            {lessonDesc && (
                              <p className="cb-caption mt-1 line-clamp-2">{lessonDesc}</p>
                            )}
                            <div className="mt-3">
                              <LessonStatusBadge status={lesson.status} />
                            </div>
                          </div>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={`/lessons/${lesson.slug}`}
                      className="group block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[color-mix(in_oklab,var(--foreground)_28%,var(--border)_72%)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_22%,transparent)]"
                    >
                      <div className="grid gap-0 sm:grid-cols-[220px_minmax(0,1fr)]">
                        <CourseThumbnail
                          src={lesson.thumbnail_url}
                          title={lesson.title}
                          eyebrow={`${lesson.order_index}`}
                          className="aspect-[16/9] w-full sm:aspect-auto sm:h-full sm:min-h-[150px]"
                          imageClassName="group-hover:scale-[1.035]"
                        />
                        <div className="min-w-0 p-4 sm:p-5">
                            <h3 className="font-semibold leading-snug text-[var(--foreground)]">
                              {lesson.title}
                            </h3>
                            {lessonDesc && (
                              <p className="cb-caption mt-1 line-clamp-2 transition-colors group-hover:text-[color-mix(in_oklab,var(--foreground)_78%,var(--muted)_22%)]">
                                {lessonDesc}
                              </p>
                            )}
                            <div className="mt-3">
                              <LessonStatusBadge status={lesson.status} />
                            </div>
                          </div>
                      </div>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ContentSection>

      {exam && (
        <section className="rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_90%,var(--muted)_10%)] p-5 sm:p-6 lg:hidden">
          <div className="cb-eyebrow">Volgende mijlpaal</div>
          <h2 className="mt-2 cb-section-title">Moduletoets</h2>
          {hasPassedThisExam ? (
            <p className="mt-2 cb-body max-w-2xl">
              Je bent geslaagd voor deze toets. Je kunt ze altijd opnieuw maken.
            </p>
          ) : !examUnlocked ? (
            <p className="mt-2 cb-body max-w-2xl">
              Rond alle lessen in deze module af om de toets vrij te spelen.
            </p>
          ) : null}
          {examUnlocked ? (
            <Link
              href={`/modules/${moduleData.slug}/exam`}
              className="mt-5 inline-flex cb-btn cb-btn-primary"
            >
              {hasPassedThisExam ? "Toets opnieuw maken" : "Start de toets"}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="mt-5 cb-btn cb-btn-secondary cursor-not-allowed opacity-60"
            >
              Toets vergrendeld
            </button>
          )}
        </section>
      )}
    </>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Academy", href: "/modules" },
          { label: moduleData.title },
        ]}
        eyebrow={`Module ${moduleData.order_index}`}
        title={moduleData.title}
        meta={
          <span className="cb-caption">
            {completedCount}/{lessons.length} lessen
          </span>
        }
      />
      <AppPageLayout main={main} rail={rail} />
    </div>
  );
}
