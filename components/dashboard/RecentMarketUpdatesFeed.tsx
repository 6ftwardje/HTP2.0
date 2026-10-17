"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MarketUpdateCard } from "@/components/market-insight/MarketUpdateCard";
import type { FeedAuthors } from "@/lib/market-feed-authors";
import styles from "./RecentMarketUpdatesFeed.module.css";
import Link from "next/link";
import type { FeedUpdate } from "@/lib/market-feed";

function Arrow({ direction }: { direction: "left" | "right" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 6 6 6-6 6"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function RecentMarketUpdatesFeed({
  updates,
  authors = {},
  title = "Nieuw in Marktinzicht",
  description = "Nieuwe berichten, charts en video's op één plek.",
}: {
  updates: FeedUpdate[];
  authors?: FeedAuthors;
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
        {visibleUpdates.map((update) => <div key={update.id} className={styles.card}><MarketUpdateCard update={update} author={authors[update.id]} compact /></div>)}
      </div>}
  </section>;
}
