import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

const dailyWork = [
  {
    href: "/admin/mentor-inbox",
    title: "Mentorvragen beantwoorden",
    description: "Bekijk gesprekken met studenten en stuur een antwoord.",
  },
  {
    href: "/admin/market-analysis",
    title: "Marktinzicht publiceren",
    description: "Beheer tekstupdates, charts en video's op één plek.",
  },
  {
    href: "/admin/live-sessions",
    title: "Live marktsessies plannen",
    description: "Plan een sessie en koppel na afloop de opname.",
  },
] as const;

const academyManagement = [
  {
    href: "/admin/students",
    title: "Studenten",
    description: "Zoek studenten, bekijk hun voortgang en beheer toegang.",
  },
  {
    href: "/admin/videos",
    title: "Modules en lessen",
    description: "Beheer lessen, volgorde, afbeeldingen en video's.",
  },
  {
    href: "/admin/exams",
    title: "Examenvragen",
    description: "Schrijf en controleer vragen per module.",
  },
] as const;

function AdminTaskList({
  items,
}: {
  items: ReadonlyArray<{ href: string; title: string; description: string }>;
}) {
  return (
    <div className="cb-panel divide-y divide-[var(--border)] overflow-hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex min-h-24 items-center justify-between gap-5 px-5 py-5 transition-colors hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] sm:px-6"
        >
          <span className="min-w-0">
            <span className="block text-base font-bold text-[var(--foreground)]">
              {item.title}
            </span>
            <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
              {item.description}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-[var(--foreground)] group-hover:underline group-hover:underline-offset-4">
            Openen
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function AdminHomePage() {
  return (
    <div>
      <PageHeader
        title="Platformbeheer"
        description="Beantwoord studentvragen, publiceer marktinzichten en houd de Academy actueel."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-6">
        <section aria-labelledby="daily-work-heading">
          <h2 id="daily-work-heading" className="cb-section-title mb-4">
            Dagelijks werk
          </h2>
          <AdminTaskList items={dailyWork} />
        </section>

        <section aria-labelledby="academy-management-heading">
          <h2 id="academy-management-heading" className="cb-section-title mb-4">
            Academy beheren
          </h2>
          <AdminTaskList items={academyManagement} />
        </section>
      </div>
    </div>
  );
}
