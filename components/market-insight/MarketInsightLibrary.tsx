"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import type { Market, WeeklyUpdate } from "@/lib/types";

type Update = WeeklyUpdate & {
  mentor: { id: string; name: string | null; email: string } | null;
};
type FormatFilter = "all" | "weekly_outlook" | "market_breakdown";
type MarketFilter = "all" | Market | "macro";
type StatusFilter = "all" | "current" | "archive";

const formats: Array<{ value: FormatFilter; label: string }> = [
  { value: "all", label: "Alles" },
  { value: "weekly_outlook", label: "Weekvooruitblikken" },
  { value: "market_breakdown", label: "Marktbreakdowns" },
];
const markets: Array<{ value: MarketFilter; label: string }> = [
  { value: "all", label: "Alle markten" },
  { value: "crypto", label: "Crypto" },
  { value: "forex", label: "Forex" },
  { value: "stocks", label: "Aandelen" },
  { value: "commodities", label: "Grondstoffen" },
  { value: "macro", label: "Macro" },
];

type Item = {
  id: string;
  format: Exclude<FormatFilter, "all">;
  title: string;
  summary: string | null;
  date: string;
  duration: number | null;
  thumbnail: string | null;
  markets: Array<Market | "macro">;
  host: string;
  status: Exclude<StatusFilter, "all">;
  href: string;
  action: string;
  reason?: string;
};

function formatLabel(value: Item["format"]) {
  if (value === "weekly_outlook") return "Weekvooruitblik";
  if (value === "market_breakdown") return "Marktbreakdown";
  return "Marktbreakdown";
}

function statusLabel(value: Item["status"]) {
  if (value === "archive") return "Archief";
  return "Actueel";
}

function marketLabel(value: Market | "macro") {
  return { crypto: "Crypto", forex: "Forex", stocks: "Aandelen", commodities: "Grondstoffen", macro: "Macro" }[value];
}

function dateLabel(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" } : {}),
  }).format(new Date(value));
}

function durationLabel(seconds: number | null) {
  if (!seconds) return null;
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}u ${minutes % 60 || ""}`.trim() : `${minutes} min`;
}

function itemMarkets(update: Update): Array<Market | "macro"> {
  if (update.markets?.length) return update.markets;
  return update.market ? [update.market] : [];
}

function ContentCard({ item, featured = false }: { item: Item; featured?: boolean }) {
  return (
    <article className={featured ? "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]" : "group grid gap-4 border-b border-[var(--border)] py-5 sm:grid-cols-[180px_minmax(0,1fr)]"}>
      <Link href={item.href} className="relative block self-center overflow-hidden rounded-lg bg-stone-950">
        <CourseThumbnail src={item.thumbnail} title={item.title} className="aspect-video w-full" />
        <span className="absolute bottom-3 left-3 rounded-md bg-black/75 px-2 py-1 text-xs font-bold text-white">{statusLabel(item.status)}</span>
      </Link>
      <div className={featured ? "flex flex-col justify-center p-6 sm:p-8" : "min-w-0 py-1"}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          <span className="text-[var(--accent)]">{formatLabel(item.format)}</span>
          {item.markets.slice(0, 3).map((market) => <span key={market}>{marketLabel(market)}</span>)}
        </div>
        {item.reason ? <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{item.reason}</p> : null}
        <h2 className={`${featured ? "mt-2 text-2xl sm:text-3xl" : "mt-2 text-lg"} font-extrabold leading-tight text-[var(--foreground)]`}>{item.title}</h2>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
          <time dateTime={item.date}>{dateLabel(item.date, item.format === "market_breakdown")}</time>
          {durationLabel(item.duration) ? <span>{durationLabel(item.duration)}</span> : null}
          <span>{item.host}</span>
        </p>
        {item.summary ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.summary}</p> : null}
        <Link href={item.href} className="mt-5 w-fit cb-btn cb-btn-primary">{item.action}</Link>
      </div>
    </article>
  );
}

function SelectChevron() {
  return (
    <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MarketInsightLibrary({ updates }: { updates: Update[] }) {
  const [format, setFormat] = useState<FormatFilter>("all");
  const [market, setMarket] = useState<MarketFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const items = useMemo<Item[]>(() => {
    const videoItems = updates.filter((update) => update.type !== "live_session").map((update): Item => {
      const itemFormat = update.type === "weekly_outlook" ? "weekly_outlook" : "market_breakdown";
      const actuality = update.actuality_status ?? "current";
      return {
        id: `video-${update.id}`,
        format: itemFormat,
        title: update.title,
        summary: update.summary,
        date: update.published_at ?? update.created_at,
        duration: update.video_duration_seconds,
        thumbnail: update.thumbnail_url,
        markets: itemMarkets(update),
        host: update.mentor?.name ?? update.mentor?.email ?? "Cryptoriez mentor",
        status: actuality === "archive" ? "archive" : "current",
        href: `/market-analysis/${update.slug}`,
        action: itemFormat === "weekly_outlook" ? "Bekijk vooruitblik" : "Bekijk breakdown",
      };
    });
    return videoItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [updates]);

  const featuredBase = items.find((item) => item.format === "weekly_outlook") ?? items[0] ?? null;
  const featured = featuredBase ? { ...featuredBase, reason: featuredBase.format === "weekly_outlook" ? "Meest recente voorbereiding" : "Meest recente analyse" } : null;
  const filtered = items.filter((item) => (format === "all" || item.format === format) && (market === "all" || item.markets.includes(market)) && (status === "all" || item.status === status));
  const reset = () => { setFormat("all"); setMarket("all"); setStatus("all"); };

  return (
    <main>
      {featured ? <section aria-label="Uitgelicht"><ContentCard item={featured} featured /></section> : null}
      <section className="mt-10" aria-labelledby="market-insight-feed">
        <div className="border-b border-[var(--border)]">
          <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Contentformaten">
            {formats.map((option) => <button key={option.value} type="button" role="tab" aria-selected={format === option.value} onClick={() => setFormat(option.value)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-bold ${format === option.value ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>{option.label}</button>)}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative text-sm font-semibold text-[var(--muted)]"><span className="sr-only">Markt</span><select value={market} onChange={(e) => setMarket(e.target.value as MarketFilter)} className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-3 pr-10 text-[var(--foreground)] sm:w-auto">{markets.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><SelectChevron /></label>
          <label className="relative text-sm font-semibold text-[var(--muted)]"><span className="sr-only">Status</span><select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-3 pr-10 text-[var(--foreground)] sm:w-auto"><option value="all">Alle statussen</option><option value="current">Actueel</option><option value="archive">Archief</option></select><SelectChevron /></label>
        </div>
        <h2 id="market-insight-feed" className="mt-8 text-xl font-extrabold">Alle marktinzichten <span className="ml-2 text-sm font-medium text-[var(--muted)]">{filtered.length}</span></h2>
        {filtered.length ? <div className="mt-2">{filtered.map((item) => <ContentCard key={item.id} item={item} />)}</div> : <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] p-8 text-center"><h3 className="font-bold">Geen marktinzichten gevonden</h3><p className="mt-2 text-sm text-[var(--muted)]">Pas je filters aan om andere content te bekijken.</p><button type="button" onClick={reset} className="mt-4 cb-btn cb-btn-secondary">Filters wissen</button></div>}
      </section>
    </main>
  );
}
