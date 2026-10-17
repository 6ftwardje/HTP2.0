import { VideoChapterLayout } from "@/components/market-insight/VideoChapterLayout";
import { editorialContext, cleanTakeaway } from "@/lib/market-editorial";
import { ArticleContent } from "@/components/market-insight/ArticleContent";
import { WeeklyUpdateAutoCompleteVideo } from "@/components/WeeklyUpdateAutoCompleteVideo";
import { isMarketArticle, marketArticleHtml } from "@/lib/market-article";
import type { WeeklyUpdate, MarketInsightChapter, MuxPlaybackTokens } from "@/lib/types";
import { getUpdateStructure } from "@/lib/market-update-structure";
import { MarketUpdateStructureContent } from "@/components/market-insight/MarketUpdateStructureContent";
import { structureFallbackBody } from "@/lib/market-update-editing";

export function MarketPostContents({ update, summary, takeaways, chapters, muxTokens, timestamp }: { update: WeeklyUpdate; summary?: string | null; takeaways: string[]; chapters: MarketInsightChapter[]; timestamp?: string | null; muxTokens: MuxPlaybackTokens | null }) {
  const article = isMarketArticle(update);
  const structure = getUpdateStructure(update);
  const projectedBody = Boolean(structure && update.body === structureFallbackBody(structure, update.summary));
  const html = article ? marketArticleHtml(projectedBody ? { ...update, body: null } : update) : "";
  const filledTakeaways = takeaways.map(cleanTakeaway).filter(Boolean);
  const context = editorialContext(summary, update.event_context);
  const structured = Boolean(structure);
  const content = <MarketUpdateStructureContent update={update}>
    {article ? html.trim() ? <ArticleContent html={html} /> : structured ? null : <p className="market-media-state" role="status">De artikelinhoud is tijdelijk niet beschikbaar.</p> :
      <div className={structured ? "mt-8" : undefined}><WeeklyUpdateAutoCompleteVideo weeklyUpdateId={update.id} videoUrl={update.video_url} videoProvider={update.video_provider} muxPlaybackId={update.mux_playback_id} muxPlaybackPolicy={update.mux_playback_policy} muxTokens={muxTokens} title={update.title} chapters={chapters} /></div>}
    {!structured && context.summary ? <section className="market-post-text-section"><h2>Samenvatting</h2><p>{context.summary}</p></section> : null}
    {!structured && context.event ? <section className="market-post-text-section"><h2>Wat is er gebeurd?</h2><p>{context.event}</p></section> : null}
    {filledTakeaways.length ? <section className="market-post-text-section"><h2>Key takeaways</h2><ol>{filledTakeaways.map((takeaway, index) => <li key={index}>{takeaway}</li>)}</ol></section> : null}
    {update.actuality_status === "archive" ? <aside className="market-post-archive">Deze analyse is gebaseerd op de marktomstandigheden op het moment van publicatie. Bekijk recentere inzichten voor de actuele situatie.</aside> : null}
  </MarketUpdateStructureContent>;
  return article ? content : <VideoChapterLayout key={update.id} chapters={chapters} provider={update.video_provider} duration={update.video_duration_seconds} timestamp={timestamp}>{content}</VideoChapterLayout>;
}
