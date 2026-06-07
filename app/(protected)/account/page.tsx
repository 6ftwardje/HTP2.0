import { ensureCurrentStudent } from "@/lib/students";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { RightRailCard } from "@/components/layout/RightRailCard";

export default async function AccountPage() {
  const { student } = await ensureCurrentStudent();

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
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
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
        <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] p-5">
          <div className="cb-eyebrow">Toegangsniveau</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {student?.access_level ?? 1}
          </div>
          <p className="mt-1 cb-caption">
            Je toegangsniveau binnen de Academy.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] p-5">
          <div className="cb-eyebrow">Programmastatus</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            Actief
          </div>
          <p className="mt-1 cb-caption">Je toegang tot de opleiding is actief.</p>
        </div>
      </div>
    </section>
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
