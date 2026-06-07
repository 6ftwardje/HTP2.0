import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { ModuleStateBadge } from "@/components/StatusBadge";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { ContentSection } from "@/components/layout/ContentSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { RightRailCard } from "@/components/layout/RightRailCard";
import { asText } from "@/lib/as-text";
import {
  getDashboardOverview,
  type DashboardModuleSummary,
} from "@/lib/dashboard";
import { getStudentOnboardingResponse } from "@/lib/onboarding";
import { ensureCurrentStudent } from "@/lib/students";

function ModuleRow({ summary }: { summary: DashboardModuleSummary }) {
  const canOpen = summary.state !== "locked";
  const content = (
    <div className="grid gap-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] sm:grid-cols-[150px_minmax(0,1fr)]">
      <CourseThumbnail
        src={summary.module.thumbnail_url}
        title={summary.module.title}
        eyebrow={`Module ${summary.module.order_index}`}
        className="aspect-[16/7] w-full sm:aspect-auto sm:h-full sm:min-h-[118px]"
        imageClassName={canOpen ? "group-hover:scale-[1.035]" : ""}
        muted={!canOpen}
      />
      <div className="flex min-w-0 items-start justify-between gap-5 p-4 sm:p-5">
        <div className="min-w-0">
          <ModuleStateBadge state={summary.state} />
          <h3 className="mt-2 font-semibold leading-snug text-[var(--foreground)]">
            {summary.module.title}
          </h3>
          <p className="mt-1 cb-caption">
            {summary.completedLessons}/{summary.totalLessons} lessen afgerond
          </p>
        </div>
        {canOpen && (
          <span className="shrink-0 text-sm font-semibold text-[var(--foreground)]">
            Openen
          </span>
        )}
      </div>
    </div>
  );

  if (!canOpen) return <li className="opacity-65">{content}</li>;

  return (
    <li>
      <Link
        href={`/modules/${summary.module.slug}`}
        className="group block rounded-2xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_22%,transparent)]"
      >
        {content}
      </Link>
    </li>
  );
}

type TodayAction = {
  title: string;
  copy: string;
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

export default async function DashboardPage() {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;

  const [overview, onboarding] = await Promise.all([
    getDashboardOverview(student.id),
    getStudentOnboardingResponse(student.id),
  ]);
  const { nextStep, modules } = overview;
  const firstName = student.name?.split(" ")[0] ?? null;
  const title = firstName ? `Welkom terug, ${firstName}` : "Welkom terug";
  const activeIndex = modules.findIndex((summary) => summary.state === "available");
  const visibleModules =
    activeIndex >= 0 ? modules.slice(activeIndex, activeIndex + 2) : modules.slice(-2);

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
        ? "Je hebt alle lessen van deze module bekeken. Rond nu de moduletoets af."
        : nextStep.type === "completed"
          ? "Mooi werk. Je hebt alle beschikbare modules doorlopen."
          : "Open de module om verder te gaan met je traject.";
  const thumbnail =
    nextStep.type === "lesson"
      ? nextStep.lesson.thumbnail_url ?? nextStep.module.thumbnail_url
      : nextStep.module?.thumbnail_url;
  const moduleTitle = nextStep.module?.title ?? "Academy";
  const moduleOrder = nextStep.module?.order_index;
  const pct =
    nextStep.totalLessons > 0
      ? Math.round((nextStep.completedLessons / nextStep.totalLessons) * 100)
      : 0;

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

  const todayActions: TodayAction[] = [
    !onboarding && !student.onboarding_skipped_at
      ? {
          title: "Maak je startpunt scherp",
          copy: "Vul je korte intake in zodat je traject en begeleiding persoonlijker worden.",
          href: "/onboarding",
          label: "Intake invullen",
          tone: "secondary",
        }
      : null,
    actionSummary?.next
      ? {
          title: "Werk je eerstvolgende opdracht af",
          copy: actionSummary.next,
          href: nextStep.href,
          label: "Naar de opdracht",
        }
      : null,
    {
      title:
        nextStep.type === "exam"
          ? "Maak je moduletoets"
          : nextStep.type === "completed"
            ? "Plan je volgende evaluatie"
            : "Ga verder met je traject",
      copy:
        nextStep.type === "exam"
          ? "Je lessen zijn afgerond. Test nu of je klaar bent voor het volgende blok."
          : nextStep.type === "completed"
            ? "Je beschikbare modules zijn afgerond. Gebruik dit moment voor reflectie of mentorship."
            : stepCopy,
      href: nextStep.href,
      label: nextStep.label,
    },
  ].filter(Boolean) as TodayAction[];

  const rail = (
    <>
      {actionSummary && (
        <RightRailCard title="Bij deze les">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {actionSummary.completed}/{actionSummary.total} opdrachten afgerond
          </p>
          {actionSummary.next ? (
            <>
              <p className="mt-3 cb-caption leading-relaxed">
                Eerstvolgende actie:
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--foreground)]">
                {actionSummary.next}
              </p>
            </>
          ) : (
            <p className="mt-3 cb-caption">
              Alle opdrachten bij deze les zijn afgerond.
            </p>
          )}
          <Link
            href={nextStep.href}
            className="mt-4 inline-flex text-sm font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
          >
            Bekijk de les
          </Link>
        </RightRailCard>
      )}

      <RightRailCard title="Zo werkt het">
        <p className="cb-caption leading-relaxed">
          Werk rustig in volgorde. Na de lessen rond je de module af met een
          toets en komt het volgende blok vrij.
        </p>
      </RightRailCard>
    </>
  );

  return (
    <div>
      <PageHeader title={title} />
      <AppPageLayout
        rail={rail}
        main={
          <>
            <section className="cb-panel p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="cb-eyebrow">Vandaag</div>
                  <h2 className="mt-2 cb-section-title">
                    Dit brengt je nu vooruit
                  </h2>
                </div>
                <div className="grid min-w-0 flex-1 gap-3 lg:max-w-3xl">
                  {todayActions.slice(0, 3).map((action, index) => (
                    <Link
                      key={`${action.href}-${action.title}`}
                      href={action.href}
                      className={[
                        "group rounded-2xl border p-4 transition-colors",
                        index === 0 && action.tone !== "secondary"
                          ? "border-[color-mix(in_oklab,var(--accent)_52%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_10%,var(--card)_90%)]"
                          : "border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_82%,var(--card)_18%)] hover:border-[color-mix(in_oklab,var(--foreground)_24%,var(--border))]",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug text-[var(--foreground)]">
                            {action.title}
                          </p>
                          <p className="mt-1 cb-caption line-clamp-2">
                            {action.copy}
                          </p>
                        </div>
                        <span
                          className={[
                            "shrink-0 text-sm font-semibold",
                            index === 0 && action.tone !== "secondary"
                              ? "text-[var(--accent)]"
                              : "text-[var(--foreground)]",
                          ].join(" ")}
                        >
                          {action.label}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section className="group overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_0_rgba(28,25,23,0.04)]">
              <div className="grid lg:grid-cols-[minmax(0,1.02fr)_minmax(300px,0.98fr)]">
                <CourseThumbnail
                  src={thumbnail}
                  title={stepTitle}
                  eyebrow={
                    moduleOrder ? `Module ${moduleOrder}` : "Jouw traject"
                  }
                  className="aspect-[16/9] min-h-[220px] w-full lg:h-full lg:min-h-[360px]"
                  imageClassName="group-hover:scale-[1.025]"
                />
                <div className="flex min-w-0 flex-col justify-between p-5 sm:p-7 lg:p-9">
                  <div>
                    <div className="cb-eyebrow">
                      {nextStep.type === "lesson"
                        ? "Jouw huidige les"
                        : nextStep.type === "exam"
                          ? "Volgende stap"
                          : nextStep.type === "completed"
                            ? "Afgerond"
                            : "Jouw huidige module"}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
                      {moduleTitle}
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.025em] text-[var(--foreground)] sm:text-3xl">
                      {stepTitle}
                    </h2>
                    <p className="mt-4 cb-body max-w-xl">{stepCopy}</p>
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold text-[var(--muted)]">
                      <span>
                        {nextStep.completedLessons}/{nextStep.totalLessons} lessen
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--border)_72%,transparent)]">
                      <div
                        className="h-full rounded-full bg-[var(--foreground)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <Link
                      href={nextStep.href}
                      className="mt-6 inline-flex w-full cb-btn cb-btn-primary sm:w-auto"
                    >
                      {nextStep.label}
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {visibleModules.length > 0 && (
              <ContentSection
                eyebrow="Jouw traject"
                title="Waar je nu staat"
                description="Je huidige blok en wat daarna volgt."
              >
                <ul className="space-y-3">
                  {visibleModules.map((summary) => (
                    <ModuleRow key={summary.module.id} summary={summary} />
                  ))}
                </ul>
                <Link
                  href="/modules"
                  className="inline-flex text-sm font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                >
                  Bekijk alle modules
                </Link>
              </ContentSection>
            )}
          </>
        }
      />
    </div>
  );
}
