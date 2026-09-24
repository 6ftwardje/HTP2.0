import Link from "next/link";
import { notFound } from "next/navigation";
import { WeeklyUpdateAutoCompleteVideo } from "@/components/WeeklyUpdateAutoCompleteVideo";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getIsoWeekNumber,
  getMarketAnalysisTypeLabel,
  getMarketLabel,
} from "@/lib/market-analysis";
import {
  getPublishedEnrichmentForWeeklyUpdate,
  getPublishedWeeklyUpdateBySlug,
} from "@/lib/weekly-updates";
import { ensureCurrentStudent } from "@/lib/students";
import {
  canAccessSubscriberContent,
  getBillingOverview,
  paidProductsEnabled,
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

function mentorName(
  mentor: { name: string | null; email: string } | null
): string {
  return mentor?.name ?? mentor?.email ?? "Cryptoriez mentor";
}

export default async function MarketAnalysisDetailPage({ params }: Props) {
  const { slug } = await params;
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const billingOverview = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, billingOverview)) {
    if (!paidProductsEnabled()) notFound();
    return <SubscriptionPaywall overview={billingOverview} title="Ontgrendel deze analyse" />;
  }
  const update = await getPublishedWeeklyUpdateBySlug(slug);
  if (!update) notFound();
  const enrichment = update.content_format === "video" ? await getPublishedEnrichmentForWeeklyUpdate(update.id) : null;
  const muxTokens = update.content_format === "video" ? getMuxPlaybackTokens({
    playbackId: update.mux_playback_id,
    playbackPolicy: update.mux_playback_policy,
    durationSeconds: update.video_duration_seconds,
  }) : null;

  const isOutlook = update.type === "weekly_outlook";
  const context = isOutlook
    ? `Week ${getIsoWeekNumber(update.week_start_date)} · ${formatDate(update.week_start_date)}`
    : `${getMarketLabel(update.market)} · ${formatDate(update.published_at ?? update.created_at)}`;
  const summary = enrichment?.summary ?? update.summary;
  const keyTakeaways = enrichment?.keyTakeaways ?? update.key_takeaways;
  const chapters = enrichment?.chapters ?? update.chapters ?? [];

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/market-analysis", label: "Marktinzicht" },
          { label: update.title },
        ]}
        eyebrow={
          isOutlook
            ? getMarketAnalysisTypeLabel(update.type)
            : `${getMarketAnalysisTypeLabel(update.type)} · ${getMarketLabel(update.market)}`
        }
        title={update.title}
        description={`${context} · ${mentorName(update.mentor)}`}
      />

      <main className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-6">
          {update.content_format === "video" ? <WeeklyUpdateAutoCompleteVideo
            weeklyUpdateId={update.id}
            videoUrl={update.video_url}
            videoProvider={update.video_provider}
            muxPlaybackId={update.mux_playback_id}
            muxPlaybackPolicy={update.mux_playback_policy}
            muxTokens={muxTokens}
            title={update.title}
            chapters={chapters}
          /> : <article className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8">
            <div className="cb-eyebrow">{update.content_format === "chart" ? "Chartupdate" : "Tekstupdate"}</div>
            {update.content_format === "chart" ? update.image_paths.map((_, index) => <figure key={index} className="overflow-hidden rounded-lg border border-[var(--border)]"><a href={`/api/market-updates/${update.id}/images/${index}`} target="_blank" rel="noopener noreferrer" aria-label={`Open chart ${index + 1} op volledige grootte`}><img src={`/api/market-updates/${update.id}/images/${index}`} alt={`Chart ${index + 1} bij ${update.title}`} className="h-auto w-full" /></a><figcaption className="px-3 py-2 text-xs text-[var(--muted)]">Chart {index + 1} · klik om te vergroten</figcaption></figure>) : null}
            <div className="whitespace-pre-wrap break-words text-[1rem] leading-8 text-[var(--foreground)]">{update.body}</div>
          </article>}

          {summary ? (
            <section className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)] p-5 sm:p-6">
              <div className="cb-eyebrow">Samenvatting</div>
              <p className="mt-4 text-[0.98rem] leading-8 text-[color-mix(in_oklab,var(--foreground)_78%,var(--muted))]">
                {summary}
              </p>
            </section>
          ) : null}
          {update.event_context ? (
            <section className="border-t border-[var(--border)] pt-6">
              <div className="cb-eyebrow">Wat is er gebeurd?</div>
              <p className="mt-3 cb-body">{update.event_context}</p>
            </section>
          ) : null}
          {update.actuality_status === "archive" ? (
            <aside className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-[var(--foreground)]">
              Deze analyse is gebaseerd op de marktomstandigheden van {formatDate(update.published_at ?? update.created_at)}. Bekijk recentere inzichten voor de actuele situatie.
            </aside>
          ) : null}
        </section>

        <aside className="h-fit rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)] p-5 sm:p-6 lg:sticky lg:top-6">
          <div className="cb-eyebrow">Key takeaways</div>
          {keyTakeaways.length > 0 ? (
            <ol className="mt-5 space-y-3">
              {keyTakeaways.map((takeaway, index) => (
                <li key={`${takeaway}-${index}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-xs font-bold text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-[var(--foreground)]">{takeaway}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 cb-body">Er zijn nog geen takeaways toegevoegd.</p>
          )}

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <p className="cb-caption">Deze analyse is educatief en geen financieel advies.</p>
            <Link
              href="/market-analysis"
              className="mt-5 inline-flex w-full cb-btn cb-btn-secondary justify-between px-5 py-3"
            >
              Terug naar Marktinzicht <span aria-hidden>→</span>
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
