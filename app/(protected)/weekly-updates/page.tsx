import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getWeeklyUpdateViewsByIds,
  listPublishedWeeklyUpdates,
} from "@/lib/weekly-updates";
import { ensureCurrentStudent } from "@/lib/students";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function mentorName(
  mentor: { name: string | null; email: string } | null
): string {
  return mentor?.name ?? mentor?.email ?? "Cryptoriez mentor";
}

export default async function WeeklyUpdatesPage() {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;

  const updates = await listPublishedWeeklyUpdates(24);
  const viewMap = await getWeeklyUpdateViewsByIds(
    student.id,
    updates.map((update) => update.id)
  );

  const latest = updates[0] ?? null;
  const archive = updates.slice(1);

  return (
    <div>
      <PageHeader
        title="Weekly Updates"
        description="Bekijk de wekelijkse marktanalyses van je mentors binnen het platform."
      />

      <main className="space-y-8">
        {latest ? (
          <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_92%,var(--background)_8%)]">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
              <Link href={`/weekly-updates/${latest.slug}`} className="relative block overflow-hidden bg-black">
                <CourseThumbnail
                  src={latest.thumbnail_url}
                  title={latest.title}
                  eyebrow={latest.market ?? "Market"}
                  className="aspect-[16/9] h-full min-h-[260px] w-full"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-black/24 text-white backdrop-blur-sm">
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden className="ml-1">
                      <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
                    </svg>
                  </div>
                </div>
              </Link>
              <div className="p-5 sm:p-7">
                <div className="cb-eyebrow text-[var(--accent)]">Nieuwste analyse</div>
                <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[var(--foreground)]">
                  {latest.title}
                </h2>
                <p className="mt-4 text-sm font-semibold text-[var(--muted)]">
                  Week van {formatDate(latest.week_start_date)} · {mentorName(latest.mentor)}
                </p>
                {latest.summary ? (
                  <p className="mt-5 max-w-xl text-[0.98rem] leading-8 text-[color-mix(in_oklab,var(--foreground)_76%,var(--muted))]">
                    {latest.summary}
                  </p>
                ) : null}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href={`/weekly-updates/${latest.slug}`} className="cb-btn cb-btn-primary px-6 py-3">
                    Bekijk analyse
                  </Link>
                  {viewMap.get(latest.id)?.watched ? (
                    <span className="cb-badge cb-badge-completed">Bekeken</span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)] p-6">
            <div className="cb-eyebrow">Nog leeg</div>
            <h2 className="mt-3 text-2xl font-extrabold text-[var(--foreground)]">
              Er staan nog geen weekly updates klaar.
            </h2>
            <p className="mt-3 cb-body">
              Zodra een mentor een update publiceert, verschijnt die hier.
            </p>
          </section>
        )}

        {archive.length > 0 ? (
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                Eerdere updates
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {archive.map((update) => (
                <Link
                  key={update.id}
                  href={`/weekly-updates/${update.slug}`}
                  className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--background)_12%)] transition hover:border-[color-mix(in_oklab,var(--accent)_45%,var(--border))]"
                >
                  <CourseThumbnail
                    src={update.thumbnail_url}
                    title={update.title}
                    eyebrow={update.market ?? "Market"}
                    className="aspect-[16/9] w-full"
                  />
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cb-caption">
                        {formatDate(update.week_start_date)}
                      </span>
                      {viewMap.get(update.id)?.watched ? (
                        <span className="cb-badge cb-badge-completed">Bekeken</span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-base font-bold text-[var(--foreground)] group-hover:underline">
                      {update.title}
                    </h3>
                    <p className="mt-2 cb-caption">
                      {mentorName(update.mentor)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
