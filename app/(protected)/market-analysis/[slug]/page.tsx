import {visibleDocuments,withUpdateDocuments} from "@/lib/pdf/catalog";
import {PdfAttachments} from "@/components/PdfAttachments";
import { MarketFollowing } from "@/components/market-insight/MarketFollowing";
import { getMarketFeedAuthors } from "@/lib/market-feed-authors";
import { followingMarketUpdates } from "@/lib/market-feed";
import { editorialContext } from "@/lib/market-editorial";
import { getUpdateMarkets, categoryLabel as updateMarketLabel } from "@/lib/market-update-structure";
import { readableMarketChapters } from "@/lib/market-chapters";
import { SourceNotificationRead } from "@/components/SourceNotificationRead";
import { notFound } from "next/navigation";
import { listMarketUpdateRubricUpdates, getPublishedEnrichmentForWeeklyUpdate, getPublishedWeeklyUpdateBySlug } from "@/lib/weekly-updates";
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
import { getUpdateStructure, PERSPECTIVE_OPTIONS, updateTypeLabel } from "@/lib/market-update-structure";

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<{ t?: string | string[] }> };

export default async function MarketAnalysisDetailPage({ params, searchParams }: Props) {
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
  const query = searchParams ? await searchParams : {};
  const timestamp = Array.isArray(query.t) ? query.t[0] : query.t;
  const article = isMarketArticle(update);
  const [enrichment, meta, candidates] = await Promise.all([
    article ? Promise.resolve(null) : getPublishedEnrichmentForWeeklyUpdate(update.id),
    getMarketPostDetailMeta(update.id),
    listMarketUpdateRubricUpdates({ freeOnly: !hasSubscriberAccess }),
  ]);
  const following = followingMarketUpdates(update, candidates.filter((item) => canStudentAccessWeeklyUpdate(item.access_tier, student, hasSubscriberAccess)));
  const followingAuthors = await getMarketFeedAuthors(following);
  const muxTokens = article ? null : getMuxPlaybackTokens({
    playbackId: update.mux_playback_id,
    playbackPolicy: update.mux_playback_policy,
    durationSeconds: update.video_duration_seconds,
  });
  const minutes = article ? articleReadingMinutes(marketArticleHtml(update), update.intro) : null;
  const duration = article ? minutes ? `${minutes} min leestijd` : null : update.video_duration_seconds ? `${Math.max(1, Math.round(update.video_duration_seconds / 60))} min video` : null;
  const markets = getUpdateMarkets(update);
  const structure = getUpdateStructure(update);
  const tags = structure ? [...getUpdateMarkets(update).map(updateMarketLabel), updateTypeLabel(structure.type), PERSPECTIVE_OPTIONS.find((option) => option.value === structure.perspective)?.label].filter((label): label is string => Boolean(label))
    : markets.map(updateMarketLabel);
  const publisherId = article ? update.published_by_student_id : null;
  const author = publisherId && publisherId !== meta.author?.student_id
    ? { name: marketUpdateAuthorName(update), object_path: null, student_id: publisherId }
    : meta.author ?? { name: update.author_name ?? marketUpdateAuthorName(update), object_path: null };
  if (article && update.published_by_display_name?.trim()) author.name = update.published_by_display_name.trim();
  return <MarketPostLayout title={update.title}
    author={author}
    publishedAt={update.published_at ?? update.created_at} tags={tags} duration={duration}
    contextLabels={structure ? [] : editorialContext(enrichment?.summary ?? update.summary, update.event_context).labels}
    following={<MarketFollowing updates={await withUpdateDocuments(following,student.id)} authors={followingAuthors} />}
    intro={structure ? null : update.intro} postId={update.id} reaction={meta.reaction}>
    <SourceNotificationRead targets={[{ table: "weekly_updates", id: String(update.id) }]}/>
    <MarketPostContents update={update} timestamp={timestamp} summary={enrichment?.summary ?? update.summary}
      takeaways={enrichment?.keyTakeaways ?? update.key_takeaways} chapters={readableMarketChapters(enrichment?.chapters ?? update.chapters, update.video_duration_seconds)} muxTokens={muxTokens} />
    <PdfAttachments documents={await visibleDocuments("update",[update.id])} viewerId={student.id}/>
  </MarketPostLayout>;
}
