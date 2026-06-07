import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { PageHeader } from "@/components/layout/PageHeader";
import { BRAND, BrandIcon } from "@/components/ui/Brand";
import { asText } from "@/lib/as-text";
import {
  getDashboardOverview,
  type DashboardModuleSummary,
} from "@/lib/dashboard";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import { syncStudentNextStep } from "@/lib/next-steps";
import { ensureCurrentStudent } from "@/lib/students";

type Props = {
  searchParams?: Promise<{ intake?: string }>;
};

function ModuleRow({
  summary,
  isCurrent,
}: {
  summary: DashboardModuleSummary;
  isCurrent: boolean;
}) {
  const canOpen = summary.state !== "locked";
  const stateLabel = isCurrent
    ? "Bezig"
    : summary.state === "completed"
      ? "Afgerond"
      : summary.state === "locked"
        ? "Vergrendeld"
        : "Beschikbaar";
  const statusColor =
    summary.state === "completed"
      ? "text-emerald-300"
      : isCurrent
        ? "text-[var(--accent)]"
        : "text-[var(--muted)]";
  const icon =
    summary.state === "completed" ? (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="m6 12.5 3.2 3.2L18 7.8"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : summary.state === "locked" ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a1 1 0 0 1 1 1v8H6v-8a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <span className="h-3.5 w-3.5 rounded-full border-2 border-current" />
    );

  const content = (
    <div
      className={[
        "grid gap-4 rounded-lg px-3 py-3 transition-colors sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:items-center sm:px-4",
        isCurrent
          ? "border border-[var(--border)] bg-white/[0.025]"
          : "border border-transparent",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-9 w-9 items-center justify-center rounded-full border",
          summary.state === "completed"
            ? "border-emerald-300/28 bg-emerald-300/[0.05] text-emerald-300"
            : isCurrent
              ? "border-[color-mix(in_oklab,var(--accent)_48%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)]",
        ].join(" ")}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight text-[var(--foreground)]">
          Module {summary.module.order_index}
        </p>
        <p className="mt-1 truncate text-sm text-[var(--muted)]">
          {summary.module.title}
        </p>
      </div>

      <div className="flex items-center justify-end gap-4">
        <span className={`text-sm font-semibold ${statusColor}`}>
          {stateLabel}
        </span>
      </div>
    </div>
  );

  if (!canOpen) return <li className="opacity-65">{content}</li>;

  return (
    <li>
      <Link
        href={`/modules/${summary.module.slug}`}
        className="group block rounded-lg outline-none focus-visible:bg-white/[0.04]"
      >
        {content}
      </Link>
    </li>
  );
}

export default async function DashboardPage({ searchParams }: Props) {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const params = searchParams ? await searchParams : {};

  const [overview, onboarding] = await Promise.all([
    getDashboardOverview(student.id),
    getStudentOnboardingResponse(student.id),
  ]);
  const { nextStep, modules } = overview;
  const intakeComplete = onboardingIsComplete(onboarding);
  const persistedNextStep = await syncStudentNextStep({
    studentId: student.id,
    intakeComplete,
    dashboardNextStep: nextStep,
  });
  const firstName = student.name?.split(" ")[0] ?? null;
  const title = firstName ? `Welkom terug, ${firstName}` : "Welkom terug";
  const activeIndex = modules.findIndex(
    (summary) => summary.state === "available"
  );
  const visibleModules =
    activeIndex >= 0
      ? modules.slice(Math.max(0, activeIndex - 1), activeIndex + 2)
      : modules.slice(-3);

  const stepTitle =
    nextStep.type === "lesson"
      ? nextStep.lesson.title
      : nextStep.type === "exam"
        ? nextStep.exam.title
        : nextStep.type === "completed"
          ? "Je traject is afgerond"
          : nextStep.module.title;
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
  const moduleTitle = nextStep.module?.title ?? "Academy";
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

  const nextStepAction = persistedNextStep
    ? {
        title: persistedNextStep.title,
        copy: persistedNextStep.description ?? "Ga verder waar je was gebleven.",
        href: persistedNextStep.href ?? "/dashboard",
        label: persistedNextStep.cta_label ?? "Openen",
        external: false,
        type: persistedNextStep.step_type,
      }
    : {
        title: "Stel een vraag aan je mentor",
        copy: "Loop je vast op deze module? Deel kort waar je naar kijkt en waar je twijfel zit.",
        href: `mailto:${BRAND.supportEmail}?subject=Mentorvraag%20over%20mijn%20module`,
        label: "Vraag stellen",
        external: true,
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
                <p className="text-sm font-semibold text-emerald-100">
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
              >
                ×
              </Link>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_92%,var(--background)_8%)] p-5 sm:p-7">
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
          {visibleModules.length > 0 && (
            <section
              id="progress"
              className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)] p-5 sm:p-6"
            >
              <div className="cb-eyebrow">Jouw traject</div>
              <ol className="mt-5 space-y-1">
                {visibleModules.map((summary, index) => {
                  const absoluteIndex =
                    activeIndex >= 0 ? Math.max(0, activeIndex - 1) + index : index;
                  return (
                    <ModuleRow
                      key={summary.module.id}
                      summary={summary}
                      isCurrent={absoluteIndex === activeIndex}
                    />
                  );
                })}
              </ol>
              <div className="mt-5">
                <Link
                  href="/modules"
                  className="inline-flex items-center gap-3 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Bekijk volledig traject
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </section>
          )}

          <section
            id="mentor"
            className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)] p-5 sm:p-6"
          >
            <div className="cb-eyebrow">Volgende stap</div>
            <div className="mt-7 grid gap-5 sm:grid-cols-[64px_minmax(0,1fr)] sm:items-start">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--accent)_32%,var(--border))] bg-white/[0.035]">
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
