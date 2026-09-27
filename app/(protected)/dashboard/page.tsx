import Link from "next/link";
import { QuickMarketUpdateComposer } from "@/components/admin/QuickMarketUpdateComposer";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { RecentMarketUpdatesFeed } from "@/components/dashboard/RecentMarketUpdatesFeed";
import { PageHeader } from "@/components/layout/PageHeader";
import { listDashboardDraftsAdmin } from "@/lib/admin/weekly-updates";
import { ADMIN_ACCESS_LEVEL } from "@/lib/admin/constants";
import { asText } from "@/lib/as-text";
import {
  canAccessSubscriberContent,
  getBillingOverview,
  paidProductsEnabled,
} from "@/lib/billing";
import {
  getDashboardOverview,
  getDashboardOverviewReadModel,
} from "@/lib/dashboard";
import { listUpcomingLiveSessions } from "@/lib/live-sessions";
import { listAdminMentorThreads } from "@/lib/mentor-chat";
import { stripModulePrefix } from "@/lib/module-title";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import { ensureCurrentStudent } from "@/lib/students";
import type { Student } from "@/lib/types";
import { listPublishedWeeklyUpdates } from "@/lib/weekly-updates";

type Props = {
  searchParams?: Promise<{ intake?: string }>;
};

function displayFirstName(name: string | null) {
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName && firstName.toLocaleLowerCase("nl-BE") !== "onbekend"
    ? firstName
    : null;
}

function sessionDate(date: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  }).format(new Date(date));
}

export default async function DashboardPage({ searchParams }: Props) {
  const [{ student }, params] = await Promise.all([
    ensureCurrentStudent(),
    searchParams ? searchParams : Promise.resolve({} as { intake?: string }),
  ]);
  if (!student) return null;

  if (student.access_level === ADMIN_ACCESS_LEVEL) {
    return <AdminDashboard />;
  }

  return <StudentDashboard student={student} intakeCompleted={params?.intake === "completed"} />;
}

async function AdminDashboard() {
  const [
    { rows: unreadThreads, missingMigration },
    drafts,
    upcomingSessions,
    recentUpdates,
  ] = await Promise.all([
    listAdminMentorThreads({ status: "unread", limit: 3 }),
    listDashboardDraftsAdmin(),
    listUpcomingLiveSessions(1),
    listPublishedWeeklyUpdates(6),
  ]);
  const nextLiveSession = upcomingSessions[0] ?? null;

  return (
    <div>
      <PageHeader
        title="Werkoverzicht"
        description="Deel marktinzichten en volg op wat aandacht nodig heeft."
      />

      <div className="space-y-10">
        <QuickMarketUpdateComposer />

        <section aria-labelledby="admin-follow-up-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="admin-follow-up-title" className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                Op te volgen
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Vragen van studenten en updates die nog niet gepubliceerd zijn.
              </p>
            </div>
            <Link href="/admin/mentor-inbox" className="text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">
              Open mentor inbox →
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-[var(--foreground)]">Ongelezen studentvragen</h3>
                <Link href="/admin/mentor-inbox?status=unread" className="text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">
                  Bekijk alles
                </Link>
              </div>
              {missingMigration ? (
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  De mentor inbox is nog niet beschikbaar. Controleer de inrichting in het beheer.
                </p>
              ) : unreadThreads.length > 0 ? (
                <ul className="mt-4 divide-y divide-[var(--border)]">
                  {unreadThreads.map((thread) => (
                    <li key={thread.id}>
                      <Link
                        href={`/admin/mentor-inbox?status=unread&thread=${thread.id}`}
                        className="group block rounded-md py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <span className="block text-sm font-semibold text-[var(--foreground)] group-hover:underline">
                          {thread.student?.name || thread.student?.email || "Student"}
                        </span>
                        <span className="mt-1 block line-clamp-1 text-sm text-[var(--muted)]">
                          {thread.lastMessage?.body || thread.subject || "Open het gesprek"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  Geen ongelezen vragen. Nieuwe berichten verschijnen hier.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-[var(--foreground)]">Conceptupdates</h3>
                <Link href="/admin/market-analysis" className="text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">
                  Beheer updates
                </Link>
              </div>
              {drafts.length > 0 ? (
                <ul className="mt-4 divide-y divide-[var(--border)]">
                  {drafts.map((draft) => (
                    <li key={draft.id}>
                      <Link
                        href={`/admin/market-analysis?update=${draft.id}`}
                        className="group flex items-center justify-between gap-3 rounded-md py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <span className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)] group-hover:underline">
                          {draft.title || "Naamloos concept"}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--muted)]">
                          {draft.content_format === "video" ? "Video" : draft.content_format === "chart" ? "Chart" : "Bericht"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  Geen concepten. Bewaar een update als concept om ze later af te werken.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-[var(--border)] pt-7 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="admin-live-title">
          <div>
            <h2 id="admin-live-title" className="text-lg font-bold text-[var(--foreground)]">
              {nextLiveSession ? "Volgende live marktsessie" : "Live marktsessies"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {nextLiveSession
                ? `${nextLiveSession.title} · ${sessionDate(nextLiveSession.starts_at)}`
                : "Er staat nog geen gepubliceerde sessie gepland."}
            </p>
          </div>
          <Link href="/admin/live-sessions" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">
            {nextLiveSession ? "Beheer sessies" : "Plan een sessie"} →
          </Link>
        </section>

        <RecentMarketUpdatesFeed
          updates={recentUpdates}
          title="Recent gepubliceerd"
          description="Deze marktupdates zijn zichtbaar voor studenten met toegang."
        />

        <nav aria-label="Meer beheertaken" className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-6 text-sm font-semibold">
          <Link href="/admin/market-analysis" className="text-[var(--foreground)] underline-offset-4 hover:underline">Marktinzicht beheren →</Link>
          <Link href="/admin/students" className="text-[var(--foreground)] underline-offset-4 hover:underline">Studenten beheren →</Link>
          <Link href="/admin" className="text-[var(--foreground)] underline-offset-4 hover:underline">Alle beheertools →</Link>
        </nav>
      </div>
    </div>
  );
}

async function StudentDashboard({
  student,
  intakeCompleted,
}: {
  student: Student;
  intakeCompleted: boolean;
}) {
  const [overview, onboarding, billingOverview, upcomingLiveSessions] = await Promise.all([
    process.env.PROJECT_SPEED_DASHBOARD_READ_MODEL === "1"
      ? getDashboardOverviewReadModel(student.id, student.access_level)
      : getDashboardOverview(student.id, student.access_level),
    getStudentOnboardingResponse(student.id),
    getBillingOverview(student.id),
    listUpcomingLiveSessions(1),
  ]);
  const { nextStep } = overview;
  const intakeComplete = onboardingIsComplete(onboarding);
  const hasSubscriberAccess = canAccessSubscriberContent(student, billingOverview);
  const recentUpdates = hasSubscriberAccess ? await listPublishedWeeklyUpdates(10) : [];
  const nextLiveSession = upcomingLiveSessions[0] ?? null;
  const firstName = displayFirstName(student.name);
  const moduleTitle = nextStep.module
    ? stripModulePrefix(nextStep.module.title, nextStep.module.order_index)
    : "Academy";
  const moduleContext = nextStep.module
    ? `Module ${nextStep.module.order_index} · ${moduleTitle}`
    : "Academy";
  const pct = nextStep.totalLessons > 0
    ? Math.round((nextStep.completedLessons / nextStep.totalLessons) * 100)
    : 0;
  const nextAction = !intakeComplete
    ? {
        title: "Vul je intake in",
        copy: "Vertel je mentor kort waar je staat. Daarna kun je verder met je lessen.",
        href: "/onboarding",
        label: "Intake invullen",
      }
    : nextStep.type === "lesson"
        ? {
            title: nextStep.lesson.title,
            copy: asText(nextStep.lesson.takeaway) ??
              asText(nextStep.lesson.description) ??
              "Bekijk de les en werk daarna de opdrachten af.",
            href: nextStep.href,
            label: nextStep.label,
          }
        : nextStep.type === "exam"
          ? {
              title: nextStep.exam.title,
              copy: "Je hebt de lessen afgerond. Maak de toets om verder te gaan.",
              href: nextStep.href,
              label: nextStep.label,
            }
          : nextStep.type === "module"
            ? {
                title: moduleTitle,
                copy: "Open de module om verder te gaan met je traject.",
                href: nextStep.href,
                label: nextStep.label,
              }
            : {
                title: "Je traject is afgerond",
                copy: "Je hebt alle beschikbare modules doorlopen. Je kunt je mentor nog steeds vragen stellen.",
                href: "/mentor",
                label: "Stel een vraag",
              };

  return (
    <div>
      <PageHeader
        title={firstName ? `Welkom terug, ${firstName}` : "Welkom terug"}
      />

      <div className="min-w-0 space-y-8 sm:space-y-10">
        {intakeCompleted && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_oklab,#34d399_32%,var(--border))] bg-emerald-400/[0.06] px-5 py-4" role="status">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Je intake is opgeslagen. Je volgende stap staat klaar.
            </p>
            <Link href="/dashboard" className="text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
              Melding sluiten
            </Link>
          </section>
        )}

        <section aria-label="Jouw volgende stap" className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] ${nextStep.module?.thumbnail_url ? "lg:grid lg:grid-cols-[minmax(0,1fr)_260px]" : ""}`}>
          <div className="min-w-0 p-5 sm:p-6">
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-[var(--foreground)]">
              {nextAction.title}
            </h2>
            <p className="mt-2 text-sm font-medium text-[var(--muted)]">
              {intakeComplete ? moduleContext : "Eerst je intake afronden"}
            </p>
            <p className="mt-4 line-clamp-2 max-w-[70ch] text-sm leading-6 text-[var(--foreground)]">
              {nextAction.copy}
            </p>
            {intakeComplete && nextStep.totalLessons > 0 && (
              <div className="mt-5 max-w-[34rem]">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-[var(--muted)]">
                  <span>{nextStep.type === "completed" ? "Trajectvoortgang" : "Modulevoortgang"} · {nextStep.completedLessons}/{nextStep.totalLessons} lessen</span>
                  <span>{pct}%</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground)_12%,transparent)]"
                  role="progressbar"
                  aria-label={nextStep.type === "completed" ? "Voortgang van je traject" : "Voortgang van deze module"}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href={nextAction.href} className="cb-btn cb-btn-primary min-h-11 px-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                {nextAction.label} <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <Link href="/modules" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline focus-visible:underline">
                Bekijk Academy
              </Link>
            </div>
          </div>
          {nextStep.module?.thumbnail_url && (
            <div className="hidden min-h-[220px] bg-[var(--surface-subtle)] lg:block">
              <CourseThumbnail
                src={nextStep.module.thumbnail_url}
                title={nextAction.title}
                priority={process.env.PROJECT_SPEED_DASHBOARD_HERO_PRIORITY === "1"}
                className="h-full w-full"
                sizes="260px"
              />
            </div>
          )}
        </section>

        {hasSubscriberAccess && <RecentMarketUpdatesFeed updates={recentUpdates} />}

        {hasSubscriberAccess && nextLiveSession && (
          <section aria-labelledby="student-live-title" className="flex flex-col gap-4 border-t border-[var(--border)] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="student-live-title" className="text-lg font-bold text-[var(--foreground)]">
                Volgende live marktsessie
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {nextLiveSession.title} · {sessionDate(nextLiveSession.starts_at)}
              </p>
            </div>
            <Link href="/live-sessions" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">
              Bekijk sessie →
            </Link>
          </section>
        )}

        {!hasSubscriberAccess && paidProductsEnabled() && (
          <section className="flex flex-col gap-4 border-t border-[var(--border)] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">Marktinzicht</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Ontgrendel Weekly Outlooks en marktupdates met een abonnement.
              </p>
            </div>
            <Link href="/account#subscription" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">
              Bekijk abonnement →
            </Link>
          </section>
        )}

        {nextStep.type !== "completed" && (
          <section id="mentor" className="flex flex-col gap-4 border-t border-[var(--border)] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">Loop je vast?</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Stel je vraag aan je mentor en ga met meer vertrouwen verder.
              </p>
            </div>
            <Link href="/mentor" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">
              Stel een vraag →
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
