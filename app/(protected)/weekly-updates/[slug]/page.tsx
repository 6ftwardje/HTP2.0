import Link from "next/link";
import { notFound } from "next/navigation";
import { WeeklyUpdateAutoCompleteVideo } from "@/components/WeeklyUpdateAutoCompleteVideo";
import { PageHeader } from "@/components/layout/PageHeader";
import { getPublishedWeeklyUpdateBySlug } from "@/lib/weekly-updates";

type Props = {
  params: Promise<{ slug: string }>;
};

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

export default async function WeeklyUpdateDetailPage({ params }: Props) {
  const { slug } = await params;
  const update = await getPublishedWeeklyUpdateBySlug(slug);
  if (!update) notFound();

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/weekly-updates", label: "Weekly Updates" },
          { label: update.title },
        ]}
        eyebrow={update.market ?? "Market update"}
        title={update.title}
        description={`Week van ${formatDate(update.week_start_date)} · ${mentorName(update.mentor)}`}
      />

      <main className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-6">
          <WeeklyUpdateAutoCompleteVideo
            weeklyUpdateId={update.id}
            videoUrl={update.video_url}
            videoProvider={update.video_provider}
            muxPlaybackId={update.mux_playback_id}
            muxPlaybackPolicy={update.mux_playback_policy}
            title={update.title}
          />

          {update.summary ? (
            <section className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)] p-5 sm:p-6">
              <div className="cb-eyebrow">Samenvatting</div>
              <p className="mt-4 text-[0.98rem] leading-8 text-[color-mix(in_oklab,var(--foreground)_78%,var(--muted))]">
                {update.summary}
              </p>
            </section>
          ) : null}
        </section>

        <aside className="h-fit rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)] p-5 sm:p-6 lg:sticky lg:top-6">
          <div className="cb-eyebrow">Key takeaways</div>
          {update.key_takeaways.length > 0 ? (
            <ol className="mt-5 space-y-3">
              {update.key_takeaways.map((takeaway, index) => (
                <li key={`${takeaway}-${index}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-xs font-bold text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-[var(--foreground)]">
                    {takeaway}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 cb-body">
              Er zijn nog geen takeaways toegevoegd.
            </p>
          )}

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <p className="cb-caption">
              Deze analyse is educatief en geen financieel advies.
            </p>
            <Link
              href="/weekly-updates"
              className="mt-5 inline-flex w-full cb-btn cb-btn-secondary justify-between px-5 py-3"
            >
              Terug naar archief
              <span aria-hidden>→</span>
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
