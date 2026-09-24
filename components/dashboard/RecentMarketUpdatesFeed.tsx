"use client";

import { useRef } from "react";
import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import type { WeeklyUpdateWithMentor } from "@/lib/weekly-updates";

const marketNames: Record<string, string> = {
  crypto: "Crypto", forex: "Forex", stocks: "Aandelen",
  commodities: "Grondstoffen", macro: "Macro",
};

function Arrow({ direction }: { direction: "left" | "right" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 6 6 6-6 6"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function RecentMarketUpdatesFeed({ updates }: { updates: WeeklyUpdateWithMentor[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const visibleUpdates = updates.filter((update) => update.type !== "live_session");

  return <section aria-labelledby="recent-market-updates" className="min-w-0">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="recent-market-updates" className="text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-[1.75rem]">Nieuw in Marktinzicht</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">De laatste updates van je mentors, op één plek.</p>
      </div>
      <div className="flex items-center gap-2">
        {visibleUpdates.length > 1 && <div className="hidden gap-2 sm:flex">
          <button type="button" onClick={() => rail.current?.scrollBy({ left: -340, behavior: "smooth" })} aria-label="Vorige marktupdates" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><Arrow direction="left" /></button>
          <button type="button" onClick={() => rail.current?.scrollBy({ left: 340, behavior: "smooth" })} aria-label="Volgende marktupdates" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><Arrow direction="right" /></button>
        </div>}
        <Link href="/market-analysis" className="inline-flex min-h-9 items-center text-sm font-bold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">Alle updates <span aria-hidden="true" className="ml-1">→</span></Link>
      </div>
    </div>
    {visibleUpdates.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-sm leading-6 text-[var(--muted)]">Er zijn nog geen marktupdates gepubliceerd. Nieuwe berichten verschijnen hier zodra je mentor ze deelt.</div> :
      <div ref={rail} tabIndex={0} role="region" aria-label="Recente marktupdates, horizontaal scrollbaar" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pr-8 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
        {visibleUpdates.map((update) => {
          const isVideo = update.content_format === "video";
          const isChart = update.content_format === "chart";
          const hasChart = isChart && Boolean(update.image_paths?.length);
          const image = hasChart ? `/api/market-updates/${update.id}/images/0` : update.thumbnail_url;
          const body = isVideo ? update.summary : update.body || update.summary;
          const date = update.published_at ?? update.created_at;
          const markets = update.markets?.length ? update.markets : update.market ? [update.market] : [];
          return <Link key={update.id} href={`/market-analysis/${update.slug}`} className="group flex w-[min(82vw,320px)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:w-[320px]">
            {isVideo || hasChart ? <div className="relative aspect-video overflow-hidden bg-[var(--surface-hover)]">
              {isVideo ? <CourseThumbnail src={image} title={update.title} className="h-full w-full transition-transform duration-200 group-hover:scale-[1.025]" /> : <img src={image ?? ""} alt={`Chart bij ${update.title}`} className="h-full w-full object-contain" />}
              {isVideo && update.video_duration_seconds ? <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-bold text-white">{Math.round(update.video_duration_seconds / 60)} min</span> : null}
            </div> : <div className="flex min-h-20 items-center gap-3 border-b border-[var(--border)] px-5 py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_18%,var(--card))] text-xs font-extrabold text-[var(--accent)]">HTP</span><span className="min-w-0 text-sm font-semibold text-[var(--foreground)]">{update.mentor?.name || "HTP Mentor"}</span></div>}
            <div className="flex min-h-[174px] flex-1 flex-col p-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[var(--muted)]"><span className="text-[var(--accent)]">{isVideo ? "Video" : isChart ? "Chartupdate" : "Bericht"}</span>{markets.slice(0, 2).map((market) => <span key={market}>· {marketNames[market] ?? market}</span>)}</div>
              <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-[var(--foreground)] group-hover:underline">{update.title}</h3>
              {body && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{body}</p>}
              <p className="mt-auto pt-4 text-xs text-[var(--muted)]"><time dateTime={date}>{new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date))}</time>{isVideo ? ` · ${update.mentor?.name || "HTP Mentor"}` : ""}</p>
            </div>
          </Link>;
        })}
      </div>}
  </section>;
}
