import { ArticleContent } from "@/components/market-insight/ArticleContent";
import { WeeklyUpdateAutoCompleteVideo } from "@/components/WeeklyUpdateAutoCompleteVideo";
import { sanitizeArticle } from "@/lib/market-article";
import type { WeeklyUpdate, MuxPlaybackTokens } from "@/lib/types";

export function MarketPostContents({ update, summary, takeaways, chapters, muxTokens }: { update: WeeklyUpdate; summary?: string | null; takeaways: string[]; chapters: Array<{ title: string; seconds: number }>; muxTokens: MuxPlaybackTokens | null }) {
  const article = update.content_kind === "article";
  const filledTakeaways = takeaways.filter((value) => value.trim());
  return <>
    {article ? update.article_html?.trim() ? <ArticleContent html={sanitizeArticle(update.article_html)} /> : <p className="market-media-state" role="status">De artikelinhoud is tijdelijk niet beschikbaar.</p> :
      <WeeklyUpdateAutoCompleteVideo weeklyUpdateId={update.id} videoUrl={update.video_url} videoProvider={update.video_provider} muxPlaybackId={update.mux_playback_id} muxPlaybackPolicy={update.mux_playback_policy} muxTokens={muxTokens} title={update.title} chapters={chapters} />}
    {summary?.trim() ? <section className="market-post-text-section"><h2>Samenvatting</h2><p>{summary}</p></section> : null}
    {update.event_context?.trim() ? <section className="market-post-text-section"><h2>Wat is er gebeurd?</h2><p>{update.event_context}</p></section> : null}
    {filledTakeaways.length ? <section className="market-post-text-section"><h2>Key takeaways</h2><ul>{filledTakeaways.map((takeaway, index) => <li key={index}>{takeaway}</li>)}</ul></section> : null}
    {update.actuality_status === "archive" ? <aside className="market-post-archive">Deze analyse is gebaseerd op de marktomstandigheden op het moment van publicatie. Bekijk recentere inzichten voor de actuele situatie.</aside> : null}
  </>;
}
