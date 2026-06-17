import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrandIcon } from "@/components/ui/Brand";
import { asText } from "@/lib/as-text";
import { getDashboardOverview } from "@/lib/dashboard";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import { stripModulePrefix } from "@/lib/module-title";
import { ensureCurrentStudent } from "@/lib/students";
import { listPublishedWeeklyUpdates } from "@/lib/weekly-updates";

type Props = {
  searchParams?: Promise<{ intake?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const [{ student }, params] = await Promise.all([
    ensureCurrentStudent(),
    searchParams ? searchParams : Promise.resolve({} as { intake?: string }),
  ]);
  if (!student) return null;

  const [overview, onboarding, weeklyUpdates] = await Promise.all([
    getDashboardOverview(student.id, student.access_level),
    getStudentOnboardingResponse(student.id),
    listPublishedWeeklyUpdates(3),
  ]);
  const { nextStep } = overview;
  const intakeComplete = onboardingIsComplete(onboarding);
  const firstName = student.name?.split(" ")[0] ?? null;
  const title = firstName ? `Welkom terug, ${firstName}` : "Welkom terug";
  const latestWeeklyUpdate = weeklyUpdates[0] ?? null;

  const stepTitle =
    nextStep.type === "lesson"
      ? nextStep.lesson.title
      : nextStep.type === "exam"
        ? nextStep.exam.title
        : nextStep.type === "completed"
          ? "Je traject is afgerond"
          : stripModulePrefix(
              nextStep.module.title,
              nextStep.module.order_index
            );
  const stepCopy =
    nextStep.type === "lesson"
      ? asText(nextStep.lesson.takeaway) ??
        asText(nextStep.lesson.description) ??
        "Bekijk de les en werk daarna de opdrachten af."
      : nextStep.type === "exam"
        ? "Je hebt alle lessen van deze module bekeken. Rond nu de toets af."
        : nextStep.type === "completed"
          ? "Mooi werk. Je hebt alle beschikbare modules doorlopen."
          : "Open de module om verder te gaan met je traject.";
  const thumbnail =
    nextStep.type === "lesson"
      ? nextStep.lesson.thumbnail_url ?? nextStep.module.thumbnail_url
      : nextStep.module?.thumbnail_url;
  const moduleTitle = nextStep.module
    ? stripModulePrefix(nextStep.module.title, nextStep.module.order_index)
    : "Academy";
  const moduleOrder = nextStep.module?.order_index;
  const headerDescription =
    nextStep.type === "completed"
      ? "Je hebt alle beschikbare modules doorlopen."
      : moduleOrder
        ? `Je bent bezig met Module ${moduleOrder}: ${moduleTitle}.`
        : "Je traject staat klaar om verder op te pakken.";
  const pct =
    nextStep.totalLessons > 0
      ? Math.round((nextStep.completedLessons / nextStep.totalLessons) * 100)
      : 0;
  const remainingLessons = Math.max(
    0,
    nextStep.totalLessons - nextStep.completedLessons
  );

  const actionSummary =
    nextStep.type === "lesson" && nextStep.actions.length > 0
      ? {
          completed: nextStep.actions.filter((_, index) =>
            nextStep.actionProgress.get(index)
          ).length,
          total: nextStep.actions.length,
          next:
            nextStep.actions.find(
              (_, index) => !nextStep.actionProgress.get(index)
            ) ?? null,
        }
      : null;

  const nextStepAction = !intakeComplete
    ? {
        title: "Vul je intake in",
        copy: "Rond je korte intake af zodat je videolessen openen en je mentor betere context heeft.",
        href: "/onboarding",
        label: "Intake invullen",
        external: false,
        type: "intake",
      }
    : nextStep.type === "lesson" && actionSummary?.next
      ? {
          title: "Werk je eerstvolgende opdracht af",
          copy: actionSummary.next,
          href: nextStep.href,
          label: "Naar de opdracht",
          external: false,
          type: "lesson_action",
        }
      : nextStep.type === "lesson"
        ? {
            title: nextStep.lesson.title,
            copy: `Ga verder met Module ${nextStep.module.order_index}: ${stripModulePrefix(nextStep.module.title, nextStep.module.order_index)}.`,
            href: nextStep.href,
            label: nextStep.label,
            external: false,
            type: "lesson",
          }
        : nextStep.type === "exam"
          ? {
              title: nextStep.exam.title,
              copy: "Je lessen zijn afgerond. Maak de toets om verder te gaan.",
              href: nextStep.href,
              label: nextStep.label,
              external: false,
              type: "exam",
            }
          : nextStep.type === "module"
            ? {
                title: stripModulePrefix(
                  nextStep.module.title,
                  nextStep.module.order_index
                ),
                copy: "Open de module om verder te gaan met je traject.",
                href: nextStep.href,
                label: nextStep.label,
                external: false,
                type: "module",
              }
            : {
                title: "Stel een vraag aan je mentor",
                copy: "Loop je vast op deze module? Deel kort waar je naar kijkt en waar je twijfel zit.",
                href: "/mentor",
                label: "Vraag stellen",
                external: false,
                type: "mentor_action",
              };
  const primaryLabel =
    nextStep.type === "lesson" ? "Start met deze les" : nextStep.label;
  const heroHref = intakeComplete ? nextStep.href : "/onboarding";
  const heroLabel = intakeComplete
    ? primaryLabel
    : "Intake invullen om te starten";
  const headerMeta = (
    <div className="min-w-[190px] text-left sm:text-right">
      <div className="mb-4 h-1 overflow-hidden rounded-sm bg-[color-mix(in_oklab,var(--foreground)_12%,transparent)]">
        <div
          className="h-full rounded-sm bg-[var(--accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm font-semibold text-[var(--foreground)]">
        {pct}% voltooid
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {remainingLessons} lessen resterend
      </p>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={title}
        description={headerDescription}
        meta={headerMeta}
      />

      <main className="min-w-0 space-y-8">
        {params?.intake === "completed" && (
          <section className="rounded-xl border border-[color-mix(in_oklab,#34d399_32%,var(--border))] bg-emerald-400/[0.06] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">
                  Intake correct opgeslagen
                </p>
                <p className="mt-1 cb-caption">
                  Je mentorcontext is bijgewerkt. Je volgende stap staat nu klaar.
                </p>
              </div>
              <Link
                href={nextStepAction.href}
                className="inline-flex text-sm font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
              >
                {nextStepAction.label}
              </Link>
              <Link
                href="/dashboard"
                aria-label="Melding sluiten"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                ×
              </Link>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:items-center">
            <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-black">
              <CourseThumbnail
                src={thumbnail}
                title={stepTitle}
                className="aspect-[16/9] min-h-[220px] w-full"
              />
              {nextStep.type === "lesson" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-black/24 text-white backdrop-blur-sm">
                    <svg
                      width="23"
                      height="23"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                      className="ml-1"
                    >
                      <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="cb-eyebrow text-[var(--accent)]">
                {moduleOrder ? `Module ${moduleOrder}` : "Jouw traject"}
              </div>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[var(--foreground)] sm:text-[2.15rem]">
                {stepTitle}
              </h2>
              <p className="mt-5 max-w-xl text-[0.98rem] leading-8 text-[color-mix(in_oklab,var(--foreground)_76%,var(--muted))]">
                {stepCopy}
              </p>
              {actionSummary && (
                <div className="mt-6 border-l border-[var(--border)] pl-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {actionSummary.completed}/{actionSummary.total} opdrachten
                    afgerond
                  </p>
                  {actionSummary.next ? (
                    <p className="mt-1 cb-caption line-clamp-2">
                      Eerstvolgende actie: {actionSummary.next}
                    </p>
                  ) : (
                    <p className="mt-1 cb-caption">
                      Alle opdrachten bij deze les zijn afgerond.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-10">
                <div className="flex items-center justify-between gap-4 text-sm text-[var(--muted)]">
                  <span>
                    {nextStep.completedLessons}/{nextStep.totalLessons} lessen
                    voltooid
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-sm bg-[color-mix(in_oklab,var(--foreground)_12%,transparent)]">
                  <div
                    className="h-full rounded-sm bg-[var(--accent)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <Link
                  href={heroHref}
                  className="mt-8 inline-flex w-full cb-btn cb-btn-primary px-7 py-3 sm:w-auto"
                >
                  {heroLabel}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <section
            id="weekly-updates"
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="cb-eyebrow">Weekly Updates</div>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight text-[var(--foreground)]">
                  Marktanalyse van de week
                </h2>
              </div>
              <Link
                href="/weekly-updates"
                className="shrink-0 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                Archief →
              </Link>
            </div>

            {latestWeeklyUpdate ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
                <Link
                  href={`/weekly-updates/${latestWeeklyUpdate.slug}`}
                  className="relative block overflow-hidden rounded-lg bg-black"
                >
                  <CourseThumbnail
                    src={latestWeeklyUpdate.thumbnail_url}
                    title={latestWeeklyUpdate.title}
                    eyebrow={latestWeeklyUpdate.market ?? "Market"}
                    className="aspect-[16/10] w-full"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-black/24 text-white backdrop-blur-sm">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="ml-0.5">
                        <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
                      </svg>
                    </div>
                  </div>
                </Link>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--muted)]">
                    Week van{" "}
                    {new Intl.DateTimeFormat("nl-NL", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(latestWeeklyUpdate.week_start_date))}
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-lg font-bold text-[var(--foreground)]">
                    {latestWeeklyUpdate.title}
                  </h3>
                  {latestWeeklyUpdate.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                      {latestWeeklyUpdate.summary}
                    </p>
                  ) : null}
                  <Link
                    href={`/weekly-updates/${latestWeeklyUpdate.slug}`}
                    className="mt-4 inline-flex cb-btn cb-btn-secondary px-4 py-2 text-sm"
                  >
                    Bekijk analyse
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] p-5">
                <p className="cb-body">
                  Er staat nog geen weekly update klaar. Zodra een mentor publiceert,
                  verschijnt de nieuwste analyse hier.
                </p>
              </div>
            )}
          </section>

          <section
            id="mentor"
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
          >
            <div className="cb-eyebrow">Volgende stap</div>
            <div className="mt-7 grid gap-5 sm:grid-cols-[64px_minmax(0,1fr)] sm:items-start">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--accent)_32%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_10%,var(--card))]">
                <BrandIcon className="h-9 w-9" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold leading-tight text-[var(--foreground)]">
                  {nextStepAction.title}
                </h2>
                <p className="mt-3 max-w-md text-[0.95rem] leading-7 text-[var(--muted)]">
                  {nextStepAction.copy}
                </p>
              </div>
            </div>
            <div className="mt-8">
              {nextStepAction.external ? (
                <a
                  href={nextStepAction.href}
                  className="inline-flex w-full cb-btn cb-btn-secondary justify-between px-5 py-3"
                >
                  {nextStepAction.label}
                  <span aria-hidden>→</span>
                </a>
              ) : (
                <Link
                  href={nextStepAction.href}
                  className="inline-flex w-full cb-btn cb-btn-secondary justify-between px-5 py-3"
                >
                  {nextStepAction.label}
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
