import Link from "next/link";
import { notFound } from "next/navigation";
import { WeeklyUpdateAutoCompleteVideo } from "@/components/WeeklyUpdateAutoCompleteVideo";
import { getMarketLabel } from "@/lib/market-analysis";
import { getPublishedWeeklyUpdateBySlug } from "@/lib/weekly-updates";
import { ensureCurrentStudent } from "@/lib/students";
import {
  canAccessSubscriberContent,
  getBillingOverview,
} from "@/lib/billing";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";
import { getMuxPlaybackTokens } from "@/lib/mux-signing";

type Props = { params: Promise<{ slug: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default async function MarketUpdateVideoPage({ params }: Props) {
  const { slug } = await params;
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const billingOverview = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, billingOverview)) {
    return <SubscriptionPaywall overview={billingOverview} title="Ontgrendel deze marktupdate" />;
  }
  const update = await getPublishedWeeklyUpdateBySlug(slug);
  if (!update || update.type !== "market_update" || !update.market) notFound();
  const muxTokens = getMuxPlaybackTokens({
    playbackId: update.mux_playback_id,
    playbackPolicy: update.mux_playback_policy,
    durationSeconds: update.video_duration_seconds,
  });

  return (
    <div className="text-[var(--foreground)]">
      <header className="mb-8 border-b-[0.5px] border-[var(--border)] pb-6">
        <Link
          href={`/updates/${update.market}`}
          className="text-sm font-bold text-[var(--accent)] hover:underline"
        >
          ← Terug naar {getMarketLabel(update.market)}
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.025em] sm:text-3xl">
          {update.title}
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {getMarketLabel(update.market)} · {formatDate(update.published_at ?? update.created_at)}
        </p>
      </header>

      <main className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-6">
          <WeeklyUpdateAutoCompleteVideo
            weeklyUpdateId={update.id}
            videoUrl={update.video_url}
            videoProvider={update.video_provider}
            muxPlaybackId={update.mux_playback_id}
            muxPlaybackPolicy={update.mux_playback_policy}
            muxTokens={muxTokens}
            title={update.title}
          />

          {update.summary ? (
            <section className="rounded-lg border-[0.5px] border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
              <h2 className="text-base font-extrabold">Samenvatting</h2>
              <p className="mt-3 text-[0.96rem] leading-7 text-[var(--muted)]">
                {update.summary}
              </p>
            </section>
          ) : null}
        </section>

        <aside className="h-fit rounded-lg border-[0.5px] border-[var(--border)] bg-[var(--card)] p-5 lg:sticky lg:top-6">
          <h2 className="text-base font-extrabold">Key takeaways</h2>
          {update.key_takeaways.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {update.key_takeaways.map((takeaway, index) => (
                <li key={`${takeaway}-${index}`} className="grid grid-cols-[26px_minmax(0,1fr)] gap-3">
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--surface-hover)] text-xs font-extrabold text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6">{takeaway}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Er zijn nog geen takeaways toegevoegd.
            </p>
          )}
          <p className="mt-6 border-t-[0.5px] border-[var(--border)] pt-5 text-xs leading-5 text-[var(--muted)]">
            Deze update is educatief en geen financieel advies.
          </p>
        </aside>
      </main>
    </div>
  );
}
