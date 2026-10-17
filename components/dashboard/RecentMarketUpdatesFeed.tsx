"use client";

import { RelativeDate } from "@/components/ui/RelativeDate";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./RecentMarketUpdatesFeed.module.css";
import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { MarketTag, marketTagMarket } from "@/components/ui/MarketTag";
import type { WeeklyUpdateWithMentor } from "@/lib/weekly-updates";
import { marketUpdateAuthorName } from "@/lib/market-update-author";

const marketNames: Record<string, string> = {
  crypto: "Crypto", forex: "Forex", stocks: "Aandelen",
  commodities: "Grondstoffen", macro: "Macro",
};

function Arrow({ direction }: { direction: "left" | "right" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 6 6 6-6 6"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function RecentMarketUpdatesFeed({
  updates,
  title = "Nieuw in Marktinzicht",
  description = "Nieuwe berichten, charts en video's op één plek.",
}: {
  updates: WeeklyUpdateWithMentor[];
  title?: string;
  description?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({ start: true, end: false });
  const visibleUpdates = updates.filter((update) => update.type !== "live_session");

  const signature=visibleUpdates.map((u)=>u.id).join(",");
  useEffect(()=>{
    const el=rail.current;if(!el)return;
    const sync=()=>setEdges({start:el.scrollLeft<=1,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-1});
    sync();const observer=new ResizeObserver(sync);observer.observe(el);el.addEventListener("scroll",sync,{passive:true});
    return()=>{observer.disconnect();el.removeEventListener("scroll",sync);};
  },[signature]);
  function move(direction: number){
    const el=rail.current;if(!el)return;
    const step=(el.firstElementChild?.getBoundingClientRect().width??el.clientWidth)+16;
    el.scrollBy({left:direction*step,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  }
  return <section aria-labelledby={id+"-title"} className={styles.section}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id+"-title"} className="cb-section-title">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {visibleUpdates.length > 1 && <div className="flex gap-2">
          <button type="button" onClick={() => move(-1)} disabled={edges.start} aria-controls={id} aria-label="Vorige inzichten" className="inline-flex h-11 w-11 items-center justify-center rounded-lg disabled:cursor-default disabled:opacity-40 border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><Arrow direction="left" /></button>
          <button type="button" onClick={() => move(1)} disabled={edges.end} aria-controls={id} aria-label="Volgende inzichten" className="inline-flex h-11 w-11 items-center justify-center rounded-lg disabled:cursor-default disabled:opacity-40 border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><Arrow direction="right" /></button>
        </div>}
        <Link href="/market-analysis" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--foreground)] underline-offset-4 hover:underline focus-visible:underline">Bekijk Marktinzicht <span aria-hidden="true" className="ml-1">→</span></Link>
      </div>
    </div>
    {visibleUpdates.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-sm leading-6 text-[var(--muted)]">Er zijn nog geen marktinzichten gepubliceerd. Nieuwe berichten verschijnen hier zodra ze gedeeld worden.</div> :
      <div ref={rail} id={id} tabIndex={0} role="region" aria-label="Nieuwe marktinzichten, horizontaal scrollbaar"
        onKeyDown={(event)=>{if(event.target===event.currentTarget && (event.key==="ArrowLeft"||event.key==="ArrowRight")){event.preventDefault();move(event.key==="ArrowRight"?1:-1);}}}
        className={styles.rail+" focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"}>
        {visibleUpdates.map((update) => {
          const isVideo = update.content_format === "video";
          const isChart = update.content_format === "chart";
          const hasChart = isChart && Boolean(update.image_paths?.length);
          const image = hasChart ? `/api/market-updates/${update.id}/images/0` : update.thumbnail_url;
          const body = isVideo ? update.summary : update.body || update.summary;
          const author = marketUpdateAuthorName(update);
          const showBody = body && body.trim().toLocaleLowerCase("nl-BE") !== update.title.trim().toLocaleLowerCase("nl-BE");
          const date = update.published_at ?? update.created_at;
          const markets = update.markets?.length ? update.markets : update.market ? [update.market] : [];
          return <Link key={update.id} href={`/market-analysis/${update.slug}`} className={styles.card+" group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"}>
            {isVideo || hasChart ? <div className="relative aspect-video overflow-hidden bg-[var(--surface-hover)]">
              {isVideo ? <CourseThumbnail src={image} title={update.title} className="h-full w-full transition-transform duration-200 group-hover:scale-[1.025]" /> : <img src={image ?? ""} alt={`Chart bij ${update.title}`} className="h-full w-full object-contain" />}
              {isVideo && update.video_duration_seconds ? <span className="absolute bottom-2 right-2 rounded bg-[var(--media-background)] px-1.5 py-0.5 text-xs font-bold text-[var(--media-foreground)]">{Math.round(update.video_duration_seconds / 60)} min</span> : null}
            </div> : <div className="flex min-h-20 items-center gap-3 border-b border-[var(--border)] px-5 py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-xs font-extrabold text-[var(--foreground)]">{author.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span><span className="min-w-0 text-sm font-semibold text-[var(--foreground)]">{author}</span></div>}
            <div className={`flex flex-1 flex-col p-5 ${isVideo || hasChart ? "min-h-[174px]" : "min-h-[154px]"}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[var(--muted)]"><span className="text-[var(--foreground)]">{isVideo ? "Video" : isChart ? "Chartupdate" : "Bericht"}</span>{markets.slice(0, 2).map((value) => {
                const market = marketTagMarket(value);
                return market ? <MarketTag key={value} market={market}>{marketNames[value] ?? value}</MarketTag> : <span key={value}>· {marketNames[value] ?? value}</span>;
              })}</div>
              <h3 className="mt-2 line-clamp-2 cb-item-title group-hover:underline">{update.title}</h3>
              {showBody && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{body}</p>}
              <p className="mt-auto pt-4 text-xs text-[var(--muted)]"><RelativeDate value={date} focusable={false} />{isVideo || hasChart ? ` · ${author}` : ""}</p>
            </div>
          </Link>;
        })}
      </div>}
  </section>;
}
