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
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { asText } from "@/lib/as-text";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";

type Props = { params: Promise<{ slug: string }> };

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function lowercaseFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

export default async function ModuleDetailPage({ params }: Props) {
  const { slug } = await params;
  const moduleData = await getModuleBySlug(slug);
  if (!moduleData) notFound();

  const { student } = await ensureCurrentStudent();
  if (!student) notFound();

  const [lessons, allModules, exam, onboarding] = await Promise.all([
    getPublishedLessonsByModuleId(moduleData.id),
    getPublishedModules(),
    getExamByModuleId(moduleData.id),
    getStudentOnboardingResponse(student.id),
  ]);
  const intakeComplete = onboardingIsComplete(onboarding);

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
  const moduleSubtitle =
    asText(moduleData.short_description) ??
    moduleIntroText ??
    "Werk stap voor stap door deze module en pas de concepten direct toe in je tradingproces.";
  const progressPercent =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const nextAvailableLesson = lessonsWithStatusList.find(
    (lesson) => lesson.status === "available"
  );
  const primaryHref = !intakeComplete
    ? "/onboarding"
    : nextAvailableLesson
      ? `/lessons/${nextAvailableLesson.slug}`
      : examUnlocked && exam
        ? `/modules/${moduleData.slug}/exam`
        : `#lessen`;
  const primaryLabel = !intakeComplete
    ? "Vul je intake in"
    : nextAvailableLesson
      ? `Ga verder met ${lowercaseFirst(nextAvailableLesson.title)}`
      : examUnlocked && exam
        ? hasPassedThisExam
          ? "Toets opnieuw maken"
          : "Start de toets"
        : "Bekijk de lessen";
  const nextStepCopy = !intakeComplete
    ? "Vul je intake in om de videolessen te openen en je mentor context te geven."
    : nextAvailableLesson
      ? `Start met ${nextAvailableLesson.title}. Dit is je eerstvolgende stap in deze module.`
      : examUnlocked && exam
        ? hasPassedThisExam
          ? "Je bent geslaagd. Je kunt de toets opnieuw maken of de lessen herhalen."
          : "Alle lessen zijn afgerond. Maak de toets om deze module af te sluiten."
        : "Werk de lessen in volgorde af. De volgende stap komt automatisch vrij.";
  const examStatus = !exam
    ? "Nog niet beschikbaar"
    : hasPassedThisExam
      ? "Geslaagd"
      : examUnlocked
        ? "Klaar om te starten"
        : "Vrij na alle lessen";

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
      <RightRailCard title="Voortgang">
        <div className="space-y-5">
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-extrabold leading-none text-[var(--foreground)]">
                  {completedCount} van {lessons.length}
                </div>
                <p className="mt-2 cb-caption">lessen voltooid</p>
              </div>
              <div className="text-sm font-semibold text-[var(--muted)]">
                {progressPercent}%
              </div>
            </div>
            <div className="mt-5 h-1 overflow-hidden rounded-sm bg-white/[0.08]">
              <div
                className="h-full rounded-sm bg-[var(--accent)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-5">
            <p className="cb-caption">Toets</p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {examStatus}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {examUnlocked
                ? "Je kunt de module afronden zodra je klaar bent."
                : "Wordt beschikbaar nadat alle lessen zijn afgerond."}
            </p>
          </div>
        </div>
      </RightRailCard>

      <RightRailCard title="Volgende stap">
        <p className="cb-caption leading-relaxed">{nextStepCopy}</p>
        <Link
          href={primaryHref}
          className="mt-5 inline-flex w-full cb-btn cb-btn-primary justify-center"
        >
          {primaryLabel}
        </Link>
      </RightRailCard>

      <RightRailCard title="Mentor ondersteuning">
        <p className="cb-caption leading-relaxed">
          Heb je een chart of vraag bij deze module? Deel je context zodat je
          mentor gerichter kan meekijken.
        </p>
        <Link
          href="/dashboard#mentor"
          className="mt-5 inline-flex w-full cb-btn cb-btn-secondary justify-between"
        >
          Stel een vraag
          <span aria-hidden>↗</span>
        </Link>
      </RightRailCard>
    </>
  );

  const main = (
    <>
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_92%,var(--background)_8%)]">
        <CourseThumbnail
          src={moduleData.thumbnail_url}
          title={moduleData.title}
          eyebrow={`Module ${moduleData.order_index}`}
          moduleNumber={moduleData.order_index}
          priority
          className="aspect-[16/8] w-full sm:aspect-[21/9]"
          sizes="(min-width: 1024px) 66vw, 100vw"
        />
        <div className="p-5 sm:p-6 lg:p-7">
          <div className="cb-eyebrow">Over deze module</div>
          <p className="mt-4 cb-body max-w-3xl">
            {moduleIntroText ??
              "Werk de lessen hieronder in volgorde af. Daarna komt de volgende stap vrij."}
          </p>
        </div>
      </section>

      <section id="lessen" className="scroll-mt-10 space-y-5">
        <div className="space-y-2">
          <div className="cb-eyebrow">Lessen</div>
          <h2 className="cb-section-title">Inhoud van deze module</h2>
          <p className="cb-caption max-w-2xl">
            {intakeComplete
              ? "Werk in volgorde. Je voortgang wordt automatisch bijgewerkt."
              : "Je kunt de inhoud bekijken. De videolessen openen zodra je intake is ingevuld."}
          </p>
        </div>

        {lessons.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="cb-caption">Deze module bevat nog geen lessen.</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--background)_12%)]">
            {lessonsWithStatusList.map((lesson) => {
              const isLocked = lesson.status === "locked";
              const intakeLocked = !intakeComplete;
              const isCurrent =
                intakeComplete && nextAvailableLesson?.id === lesson.id;
              const lessonDesc = asText(lesson.description);
              const duration = formatDuration(lesson.video_duration_seconds);
              const statusLabel = intakeLocked
                ? "Intake vereist"
                : lesson.status === "completed"
                  ? "Afgerond"
                  : lesson.status === "available"
                    ? "Beschikbaar"
                    : "Vergrendeld";
              const statusClass =
                lesson.status === "completed"
                  ? "text-emerald-300"
                  : lesson.status === "available" && !intakeLocked
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)]";
              const rowContent = (
                <div
                  className={[
                    "grid min-w-0 gap-4 px-4 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5",
                    isCurrent
                      ? "bg-[color-mix(in_oklab,var(--accent)_8%,var(--card))]"
                      : "bg-transparent",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3
                        className={[
                          "font-semibold leading-snug",
                          isLocked || intakeLocked
                            ? "text-[color-mix(in_oklab,var(--foreground)_62%,var(--muted)_38%)]"
                            : "text-[var(--foreground)]",
                        ].join(" ")}
                      >
                        {lesson.title}
                      </h3>
                      <span className={`text-xs font-semibold ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {lessonDesc && (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                        {lessonDesc}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    {duration && (
                      <span className="text-xs font-semibold text-[var(--muted)]">
                        {duration}
                      </span>
                    )}
                    {(isLocked || intakeLocked) && (
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)]"
                        aria-label="Vergrendeld"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M7 11V8a5 5 0 0 1 10 0v3m-11 0h12v9H6v-9Z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              );

              return (
                <li key={lesson.id} className="border-b border-[var(--border)] last:border-b-0">
                  {isLocked || intakeLocked ? (
                    <div className="grid gap-0 sm:grid-cols-[176px_minmax(0,1fr)]">
                      <CourseThumbnail
                        src={lesson.thumbnail_url}
                        title={lesson.title}
                        eyebrow={`${lesson.order_index}`}
                        className="aspect-[16/9] w-full sm:aspect-auto sm:h-full sm:min-h-[118px]"
                        muted
                      />
                      {rowContent}
                    </div>
                  ) : (
                    <Link
                      href={`/lessons/${lesson.slug}`}
                      className="group grid gap-0 transition-colors hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color-mix(in_oklab,var(--foreground)_22%,transparent)] sm:grid-cols-[176px_minmax(0,1fr)]"
                    >
                      <CourseThumbnail
                        src={lesson.thumbnail_url}
                        title={lesson.title}
                        eyebrow={`${lesson.order_index}`}
                        className="aspect-[16/9] w-full sm:aspect-auto sm:h-full sm:min-h-[118px]"
                        imageClassName="group-hover:scale-[1.035]"
                      />
                      {rowContent}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );

  return (
    <div className="space-y-10">
      <header className="grid gap-8 border-b border-[var(--border)] pb-9 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-end">
        <div>
          <nav className="cb-caption" aria-label="Breadcrumb">
            <Link
              href="/modules"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Academy
            </Link>
            <span className="mx-2 text-[var(--muted)]">/</span>
            <span>Module {moduleData.order_index}</span>
          </nav>
          <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-[1.04] text-[var(--foreground)] sm:text-5xl">
            Module {moduleData.order_index}: {moduleData.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {moduleSubtitle}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={primaryHref} className="cb-btn cb-btn-primary gap-2">
              <span aria-hidden>▶</span>
              {primaryLabel}
            </Link>
            <Link
              href="#lessen"
              className="cb-btn cb-btn-secondary border-transparent bg-transparent px-0 text-[var(--accent)] hover:bg-transparent hover:text-[var(--foreground)]"
            >
              Bekijk alle lessen
            </Link>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="h-1 overflow-hidden rounded-sm bg-white/[0.08]">
            <div
              className="h-full rounded-sm bg-[var(--accent)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">
            {progressPercent}% voltooid
          </p>
          <p className="mt-1 cb-caption">
            {completedCount} van {lessons.length} lessen
          </p>
        </div>
      </header>

      <AppPageLayout main={main} rail={rail} railClassName="lg:top-8" />
    </div>
  );
}
