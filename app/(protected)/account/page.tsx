import Link from "next/link";
import { ensureCurrentStudent } from "@/lib/students";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { RightRailCard } from "@/components/layout/RightRailCard";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";

function formatIntakeValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Nog niet ingevuld";
  }
  return String(value).replaceAll("_", " ");
}

export default async function AccountPage() {
  const { student } = await ensureCurrentStudent();
  const onboarding = student
    ? await getStudentOnboardingResponse(student.id)
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

  const rail = (
    <>
      <RightRailCard title="Lidmaatschap">
        <p className="cb-caption leading-relaxed">
          Je toegang is gekoppeld aan je account. Heb je een vraag?
          Gebruik de hulplink in de zijbalk.
        </p>
      </RightRailCard>
      <RightRailCard title="Status">
        <div className="text-sm font-semibold text-[var(--foreground)]">Actief</div>
        <p className="mt-2 cb-caption">
          Je hebt momenteel toegang tot je opleidingstraject.
        </p>
      </RightRailCard>
    </>
  );

  const main = (
    <div className="space-y-6">
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

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] p-5">
            <div className="cb-eyebrow">Toegangsniveau</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {student?.access_level ?? 1}
            </div>
            <p className="mt-1 cb-caption">
              Je toegangsniveau binnen de Academy.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] p-5">
            <div className="cb-eyebrow">Programmastatus</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              Actief
            </div>
            <p className="mt-1 cb-caption">Je toegang tot de opleiding is actief.</p>
          </div>
        </div>
      </section>

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
                {formatIntakeValue(onboarding?.experience_level)}
              </dd>
            </div>
            <div>
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Markt</dt>
              <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                {formatIntakeValue(onboarding?.primary_market)}
              </dd>
            </div>
            <div>
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Tijd per week</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">
                {formatIntakeValue(onboarding?.weekly_time_commitment)}
              </dd>
            </div>
            <div>
              <dt className="cb-caption text-xs font-bold uppercase tracking-[0.13em]">Zelfinschatting</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">
                {formatIntakeValue(onboarding?.confidence_score)}/5
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
        description="Je persoonlijke gegevens en toegang tot de Academy."
      />
      <AppPageLayout main={main} rail={rail} />
    </div>
  );
}
