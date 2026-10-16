import { ArticleContent } from "@/components/market-insight/ArticleContent";
import { WeeklyUpdateAutoCompleteVideo } from "@/components/WeeklyUpdateAutoCompleteVideo";
import { isMarketArticle, marketArticleHtml } from "@/lib/market-article";
import type { WeeklyUpdate, MuxPlaybackTokens } from "@/lib/types";
import { getUpdateStructure } from "@/lib/market-update-structure";
import { MarketUpdateStructureContent } from "@/components/market-insight/MarketUpdateStructureContent";
import { structureFallbackBody } from "@/lib/market-update-editing";

export function MarketPostContents({ update, summary, takeaways, chapters, muxTokens }: { update: WeeklyUpdate; summary?: string | null; takeaways: string[]; chapters: Array<{ title: string; seconds: number }>; muxTokens: MuxPlaybackTokens | null }) {
  const article = isMarketArticle(update);
  const structure = getUpdateStructure(update);
  const projectedBody = Boolean(structure && update.body === structureFallbackBody(structure, update.summary));
  const html = article ? marketArticleHtml(projectedBody ? { ...update, body: null } : update) : "";
  const filledTakeaways = takeaways.filter((value) => value.trim());
  const structured = Boolean(structure);
  return <MarketUpdateStructureContent update={update}>
    {article ? html.trim() ? <ArticleContent html={html} /> : structured ? null : <p className="market-media-state" role="status">De artikelinhoud is tijdelijk niet beschikbaar.</p> :
      <div className={structured ? "mt-8" : undefined}><WeeklyUpdateAutoCompleteVideo weeklyUpdateId={update.id} videoUrl={update.video_url} videoProvider={update.video_provider} muxPlaybackId={update.mux_playback_id} muxPlaybackPolicy={update.mux_playback_policy} muxTokens={muxTokens} title={update.title} chapters={chapters} /></div>}
    {!structured && summary?.trim() ? <section className="market-post-text-section"><h2>Samenvatting</h2><p>{summary}</p></section> : null}
    {!structured && update.event_context?.trim() ? <section className="market-post-text-section"><h2>Wat is er gebeurd?</h2><p>{update.event_context}</p></section> : null}
    {filledTakeaways.length ? <section className="market-post-text-section"><h2>Key takeaways</h2><ul>{filledTakeaways.map((takeaway, index) => <li key={index}>{takeaway}</li>)}</ul></section> : null}
    {update.actuality_status === "archive" ? <aside className="market-post-archive">Deze analyse is gebaseerd op de marktomstandigheden op het moment van publicatie. Bekijk recentere inzichten voor de actuele situatie.</aside> : null}
  </MarketUpdateStructureContent>;
}
