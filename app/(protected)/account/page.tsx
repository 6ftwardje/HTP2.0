import Link from "next/link";
import { ensureCurrentStudent } from "@/lib/students";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";
import {
  formatConfidenceScore,
  formatIntakeChoice,
  formatWeeklyTimeCommitment,
} from "@/lib/intake";
import { getBillingOverview, paidProductsEnabled } from "@/lib/billing";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { AcademyCard } from "@/components/billing/AcademyCard";

type Props = {
  searchParams: Promise<{ billing?: string }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const { billing } = await searchParams;
  const onboarding = student
    ? await getStudentOnboardingResponse(student.id)
    : null;
  const showPaidProducts = paidProductsEnabled();
  const billingOverview = showPaidProducts
    ? await getBillingOverview(student.id)
    : null;
  const intakeComplete = onboardingIsComplete(onboarding);

  const initials = student?.name
    ? student.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "";

  const main = (
    <div className="space-y-6">
      {showPaidProducts && billing === "error" ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          De betaalpagina kon niet worden geopend. Probeer opnieuw of neem contact op met support.
        </div>
      ) : null}
      {showPaidProducts && billing === "cancelled" ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm text-[var(--foreground)]">
          De aankoop is geannuleerd. Er werd niets gewijzigd aan je toegang.
        </div>
      ) : null}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--border)_12%)] text-base font-bold text-[var(--foreground)]">
              {initials || "CB"}
            </div>
            <div className="min-w-0">
              <div className="cb-eyebrow">Lid</div>
              <div className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {student?.name ?? "Niet ingesteld"}
              </div>
              <div className="cb-caption mt-1">{student?.email ?? "—"}</div>
            </div>
          </div>

          <form action="/auth/signout" method="post" className="shrink-0">
            <button type="submit" className="cb-btn cb-btn-secondary">
              Afmelden
            </button>
          </form>
        </div>

      </section>

      {showPaidProducts && billingOverview ? (
        <>
          <SubscriptionCard overview={billingOverview} />
          <AcademyCard hasAcademyAccess={student.access_level >= 2} />
        </>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--background)_12%)] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="cb-eyebrow">Jouw intake</div>
            <h2 className="mt-3 cb-section-title">Mentorcontext</h2>
            <p className="mt-2 cb-caption max-w-2xl">
              Deze informatie helpt mentors en toekomstige AI-coaching om je
              huidige staat beter te begrijpen.
            </p>
          </div>
          <Link href="/onboarding" className="cb-btn cb-btn-secondary shrink-0">
            {intakeComplete ? "Intake aanpassen" : "Intake invullen"}
          </Link>
        </div>

        {intakeComplete ? (
          <dl className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Ervaring</dt>
              <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                {formatIntakeChoice(onboarding?.experience_level)}
              </dd>
            </div>
            <div>
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Markt</dt>
              <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                {formatIntakeChoice(onboarding?.primary_market)}
              </dd>
            </div>
            <div>
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Tijd per week</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">
                {formatWeeklyTimeCommitment(onboarding?.weekly_time_commitment)}
              </dd>
            </div>
            <div>
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Zelfinschatting</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">
                {formatConfidenceScore(onboarding?.confidence_score)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Grootste uitdaging</dt>
              <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                {onboarding?.main_challenge || "Nog niet ingevuld"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">90 dagen doel</dt>
              <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                {onboarding?.goal_90_days || "Nog niet ingevuld"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-7 rounded-lg border border-[var(--border)] bg-white/[0.025] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Je intake is nog niet afgerond.
            </p>
            <p className="mt-2 cb-caption">
              Je kunt rondkijken op het platform, maar de videocourse opent pas
              nadat deze context is ingevuld.
            </p>
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Academy", href: "/modules" }, { label: "Profiel" }]}
        eyebrow="Profiel"
        title="Jouw profiel"
        description="Je persoonlijke gegevens en mentorcontext."
      />
      <AppPageLayout main={main} />
    </div>
  );
}
