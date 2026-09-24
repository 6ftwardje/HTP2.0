"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import type { Market, WeeklyUpdate, WeeklyUpdateContentFormat } from "@/lib/types";

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
  contentFormat: WeeklyUpdateContentFormat;
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
  if (!featured && item.contentFormat !== "video") {
    const preview = item.summary?.trim() ?? "";
    const titleRepeatsBody = preview.toLocaleLowerCase("nl-BE").startsWith(item.title.trim().toLocaleLowerCase("nl-BE"));
    const initials = item.host.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
    return <article className="group border-b border-[var(--border)] py-6 first:pt-5">
      <div className="flex gap-3 sm:gap-4">
        <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_18%,var(--card))] text-xs font-extrabold text-[var(--accent)] ring-1 ring-[var(--border)]">{initials || "HT"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"><span className="font-bold text-[var(--foreground)]">{item.host}</span><span className="text-[var(--muted)]">·</span><time dateTime={item.date} className="text-[var(--muted)]">{dateLabel(item.date, true)}</time></div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]"><span className="font-bold text-[var(--accent)]">{item.contentFormat === "chart" ? "Chartupdate" : "Marktupdate"}</span>{item.markets.map((market) => <span key={market} className="rounded-full border border-[var(--border)] px-2 py-0.5">{marketLabel(market)}</span>)}{item.status === "archive" ? <span>· Archief</span> : null}</div>
          {!titleRepeatsBody ? <h3 className="mt-3 text-lg font-bold leading-snug text-[var(--foreground)]">{item.title}</h3> : null}
          {preview ? <p className="mt-2 line-clamp-4 whitespace-pre-line break-words text-[0.95rem] leading-7 text-[var(--foreground)]">{preview}</p> : null}
          {item.contentFormat === "chart" && item.thumbnail ? <Link href={item.href} aria-label={`Bekijk chartupdate: ${item.title}`} className="mt-4 block w-fit max-w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]"><img src={item.thumbnail} alt={`Chart bij ${item.title}`} className="max-h-[320px] w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]" /></Link> : null}
          <Link href={item.href} className="mt-3 inline-flex min-h-9 items-center gap-1 text-sm font-bold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">{item.contentFormat === "chart" ? "Bekijk chart en duiding" : preview.length > 280 ? "Lees verder" : "Open bericht"}<span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span></Link>
        </div>
      </div>
    </article>;
  }

  if (!featured) {
    return <article className="group grid gap-4 border-b border-[var(--border)] py-6 sm:grid-cols-[minmax(180px,240px)_minmax(0,1fr)] sm:gap-5">
      <Link href={item.href} aria-label={`Bekijk video: ${item.title}`} className="relative block h-fit overflow-hidden rounded-lg bg-stone-950"><CourseThumbnail src={item.thumbnail} title={item.title} className="aspect-video w-full transition-transform duration-200 group-hover:scale-[1.025]" />{durationLabel(item.duration) ? <span className="absolute bottom-2 right-2 rounded bg-black/85 px-1.5 py-0.5 text-xs font-bold text-white">{durationLabel(item.duration)}</span> : null}</Link>
      <div className="min-w-0 self-center"><div className="flex flex-wrap gap-x-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--accent)]"><span>{formatLabel(item.format)}</span>{item.markets.slice(0, 2).map((market) => <span key={market} className="text-[var(--muted)]">· {marketLabel(market)}</span>)}</div><Link href={item.href} className="mt-2 block text-lg font-bold leading-snug text-[var(--foreground)] group-hover:underline">{item.title}</Link><p className="mt-2 text-sm text-[var(--muted)]">{item.host} · <time dateTime={item.date}>{dateLabel(item.date)}</time>{item.status === "archive" ? " · Archief" : ""}</p>{item.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.summary}</p> : null}</div>
    </article>;
  }

  return (
    <article className={featured ? "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]" : "group grid gap-4 border-b border-[var(--border)] py-5 sm:grid-cols-[180px_minmax(0,1fr)]"}>
      <Link href={item.href} className="relative block self-center overflow-hidden rounded-lg bg-stone-950">
        {item.contentFormat === "chart" && item.thumbnail ? <img src={item.thumbnail} alt={`Chart bij ${item.title}`} className="aspect-video w-full object-contain" /> : item.contentFormat === "text" ? <div className="flex aspect-video items-center justify-center bg-[var(--card)] text-3xl font-extrabold text-[var(--foreground)]">Marktupdate</div> : <CourseThumbnail src={item.thumbnail} title={item.title} className="aspect-video w-full" />}
        <span className="absolute left-3 top-3 rounded-md bg-black/75 px-2 py-1 text-xs font-bold text-white">{item.contentFormat === "chart" ? "Chart" : item.contentFormat === "text" ? "Tekst" : "Video"}</span>
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
    const allItems = updates.filter((update) => update.type !== "live_session").map((update): Item => {
      const itemFormat = update.type === "weekly_outlook" ? "weekly_outlook" : "market_breakdown";
      const actuality = update.actuality_status ?? "current";
      return {
        id: `update-${update.id}`,
        format: itemFormat,
        title: update.title,
        summary: update.content_format === "video" ? update.summary : update.body,
        date: update.published_at ?? update.created_at,
        duration: update.content_format === "video" ? update.video_duration_seconds : null,
        thumbnail: update.content_format === "chart" ? `/api/market-updates/${update.id}/images/0` : update.thumbnail_url,
        contentFormat: update.content_format,
        markets: itemMarkets(update),
        host: update.mentor?.name && update.mentor.name !== "Onbekend" ? update.mentor.name : "HTP Mentor",
        status: actuality === "archive" ? "archive" : "current",
        href: `/market-analysis/${update.slug}`,
        action: update.content_format === "video" ? (itemFormat === "weekly_outlook" ? "Bekijk vooruitblik" : "Bekijk breakdown") : "Lees update",
      };
    });
    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [updates]);

  const featuredBase = items.find((item) => item.format === "weekly_outlook" && item.contentFormat === "video") ?? null;
  const featured = featuredBase ? { ...featuredBase, reason: featuredBase.format === "weekly_outlook" ? "Meest recente voorbereiding" : "Meest recente analyse" } : null;
  const filtersActive = format !== "all" || market !== "all" || status !== "all";
  const filtered = items.filter((item) =>
    (filtersActive || item.id !== featuredBase?.id) &&
    (format === "all" || item.format === format) &&
    (market === "all" || item.markets.includes(market)) &&
    (status === "all" || item.status === status)
  );
  const reset = () => { setFormat("all"); setMarket("all"); setStatus("all"); };

  return (
    <main>
      {featured && !filtersActive ? <section aria-label="Uitgelicht"><ContentCard item={featured} featured /></section> : null}
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
        <h2 id="market-insight-feed" className="mt-8 text-xl font-extrabold">{filtersActive ? "Resultaten" : featured ? "Meer marktinzichten" : "Alle marktinzichten"} <span className="ml-2 text-sm font-medium text-[var(--muted)]">{filtered.length}</span></h2>
        {filtered.length ? <div className="mt-2">{filtered.map((item) => <ContentCard key={item.id} item={item} />)}</div> : <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] p-8 text-center"><h3 className="font-bold">{filtersActive ? "Geen marktinzichten gevonden" : "Nog geen andere marktinzichten"}</h3>{filtersActive ? <><p className="mt-2 text-sm text-[var(--muted)]">Pas je filters aan om andere content te bekijken.</p><button type="button" onClick={reset} className="mt-4 cb-btn cb-btn-secondary">Filters wissen</button></> : null}</div>}
      </section>
    </main>
  );
}
