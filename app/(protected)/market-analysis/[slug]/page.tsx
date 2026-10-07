import { notFound } from "next/navigation";
import { getMarketLabel } from "@/lib/market-analysis";
import { getPublishedEnrichmentForWeeklyUpdate, getPublishedWeeklyUpdateBySlug } from "@/lib/weekly-updates";
import { ensureCurrentStudent } from "@/lib/students";
import { canAccessSubscriberContent, getBillingOverview, paidProductsEnabled } from "@/lib/billing";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";
import { getMuxPlaybackTokens } from "@/lib/mux-signing";
import { canStudentAccessWeeklyUpdate } from "@/lib/weekly-update-access";
import { getMarketPostDetailMeta } from "@/lib/market-post-detail";
import { articleReadingMinutes, isMarketArticle, marketArticleHtml } from "@/lib/market-article";
import { marketUpdateAuthorName } from "@/lib/market-update-author";
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
  const article = isMarketArticle(update);
  const [enrichment, meta] = await Promise.all([
    article ? Promise.resolve(null) : getPublishedEnrichmentForWeeklyUpdate(update.id),
    getMarketPostDetailMeta(update.id),
  ]);
  const muxTokens = article ? null : getMuxPlaybackTokens({
    playbackId: update.mux_playback_id,
    playbackPolicy: update.mux_playback_policy,
    durationSeconds: update.video_duration_seconds,
  });
  const minutes = article ? articleReadingMinutes(marketArticleHtml(update), update.intro) : null;
  const duration = article ? minutes ? `${minutes} min leestijd` : null : update.video_duration_seconds ? `${Math.max(1, Math.round(update.video_duration_seconds / 60))} min video` : null;
  const markets = update.markets?.length ? update.markets : update.market ? [update.market] : [];
  const tags = markets.map((market) => market === "macro" ? "Macro" : getMarketLabel(market));
  const publisherId = article ? update.published_by_student_id : null;
  const author = publisherId && publisherId !== meta.author?.student_id
    ? { name: marketUpdateAuthorName(update), object_path: null, student_id: publisherId }
    : meta.author ?? { name: update.author_name ?? marketUpdateAuthorName(update), object_path: null };
  if (article && update.published_by_display_name?.trim()) author.name = update.published_by_display_name.trim();
  return <MarketPostLayout title={update.title}
    author={author}
    publishedAt={update.published_at ?? update.created_at} tags={tags} duration={duration}
    intro={update.intro} postId={update.id} reaction={meta.reaction}>
    <MarketPostContents update={update} summary={enrichment?.summary ?? update.summary}
      takeaways={enrichment?.keyTakeaways ?? update.key_takeaways} chapters={enrichment?.chapters ?? update.chapters ?? []} muxTokens={muxTokens} />
  </MarketPostLayout>;
}
