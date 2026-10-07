import { notFound } from "next/navigation";
import { getMarketLabel } from "@/lib/market-analysis";
import { getPublishedEnrichmentForWeeklyUpdate, getPublishedWeeklyUpdateBySlug } from "@/lib/weekly-updates";
import { ensureCurrentStudent } from "@/lib/students";
import { canAccessSubscriberContent, getBillingOverview, paidProductsEnabled } from "@/lib/billing";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";
import { getMuxPlaybackTokens } from "@/lib/mux-signing";
import { canStudentAccessWeeklyUpdate } from "@/lib/weekly-update-access";
import { getMarketPostDetailMeta } from "@/lib/market-post-detail";
import { articleReadingMinutes } from "@/lib/market-article";
import { MarketPostLayout } from "@/components/market-insight/MarketPostLayout";
import { MarketPostContents } from "@/components/market-insight/MarketPostContents";

type Props = { params: Promise<{ slug: string }> };

export default async function MarketAnalysisDetailPage({ params }: Props) {
  const { slug } = await params;
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const billingOverview = await getBillingOverview(student.id);
  const hasSubscriberAccess = canAccessSubscriberContent(student, billingOverview);
  const update = await getPublishedWeeklyUpdateBySlug(slug);
  if (
    (!update && !hasSubscriberAccess) ||
    (update && !canStudentAccessWeeklyUpdate(update.access_tier, student, hasSubscriberAccess))
  ) {
    if (!paidProductsEnabled()) notFound();
    return <SubscriptionPaywall overview={billingOverview} title="Ontgrendel deze analyse" />;
  }
  if (!update) notFound();
  const article = update.content_kind === "article";
  const [enrichment, meta] = await Promise.all([
    article ? Promise.resolve(null) : getPublishedEnrichmentForWeeklyUpdate(update.id),
    getMarketPostDetailMeta(update.id),
  ]);
  const muxTokens = article ? null : getMuxPlaybackTokens({
    playbackId: update.mux_playback_id,
    playbackPolicy: update.mux_playback_policy,
    durationSeconds: update.video_duration_seconds,
  });
  const minutes = article ? articleReadingMinutes(update.article_html ?? "", update.intro) : null;
  const duration = article ? minutes ? `${minutes} min leestijd` : null : update.video_duration_seconds ? `${Math.max(1, Math.round(update.video_duration_seconds / 60))} min video` : null;
  const markets = update.markets?.length ? update.markets : update.market ? [update.market] : [];
  const tags = markets.map((market) => market === "macro" ? "Macro" : getMarketLabel(market));
  return <MarketPostLayout title={update.title}
    author={meta.author ?? { name: update.mentor?.name ?? update.author_name ?? "Auteur", object_path: null }}
    publishedAt={update.published_at ?? update.created_at} tags={tags} duration={duration}
    intro={update.intro} postId={update.id} reaction={meta.reaction}>
    <MarketPostContents update={update} summary={enrichment?.summary ?? update.summary}
      takeaways={enrichment?.keyTakeaways ?? update.key_takeaways} chapters={enrichment?.chapters ?? update.chapters ?? []} muxTokens={muxTokens} />
  </MarketPostLayout>;
}
