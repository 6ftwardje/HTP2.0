"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { MarketTag, marketTagMarket } from "@/components/ui/MarketTag";
import { MarketUpdateCard } from "./MarketUpdateCard";
import type { FeedUpdate } from "@/lib/market-feed";
import type { FeedAuthors } from "@/lib/market-feed-authors";
import { availableFeedMarkets, filterMarketFeed, latestWeeklyOutlook, outlookPeriod, type FeedView, type FeedContent, type FeedMarket } from "@/lib/market-feed";
import { readableMarketChapters } from "@/lib/market-chapters";
import { categoryLabel, getUpdateMarkets, getUpdateStructure, isPinnedUpdate, isUrgentUpdate, SETUP_STATUS_OPTIONS, type SetupStatus } from "@/lib/market-update-structure";
import { supportsMarketSeeking } from "@/lib/market-video-navigation";
import styles from "./MarketInsightLibrary.module.css";

const views: Array<{ value: FeedView; label: string }> = [{ value: "current", label: "Actueel" }, { value: "open", label: "Open setups" }, { value: "archive", label: "Archief" }];
function WeeklyHero({ update, now }: { update: FeedUpdate; now: number }) {
  const { period, label } = outlookPeriod(update, new Date(now));
  const chapters = supportsMarketSeeking(update.video_provider) && update.content_kind !== "article" && update.content_format === "video"
    ? readableMarketChapters(update.chapters, update.video_duration_seconds).filter((chapter) => chapter.market && getUpdateMarkets(update).includes(chapter.market)) : [];
  const marketChapters = chapters.filter((chapter, index) => chapters.findIndex((other) => other.market === chapter.market) === index);
  return <section className={styles.hero} aria-label="Weekvooruitblik">
    <Link href={`/market-analysis/${update.slug}`} className={styles.heroLink}>
      <div className={styles.heroImage}><CourseThumbnail src={update.thumbnail_url} title={update.title} className="h-full w-full" imageClassName="!object-contain" sizes="(min-width: 768px) 55vw, 100vw" priority /></div>
      <div className={styles.heroBody}><p className={styles.period}>{label} · {period}</p><h2>{update.title}</h2>
        <div className={styles.heroTags}>{getUpdateMarkets(update).map((market) => marketTagMarket(market) ? <MarketTag key={market} market={marketTagMarket(market)!}>{categoryLabel(market)}</MarketTag> : <span key={market}>{categoryLabel(market)}</span>)}</div>
        <span className={styles.heroOpen}>Open vooruitblik <span aria-hidden="true">→</span></span>
      </div>
    </Link>
    {marketChapters.length ? <nav className={styles.chapterLinks} aria-label="Markten in deze weekvooruitblik"><span>Direct naar</span>{marketChapters.map((chapter) => <Link key={chapter.market} href={`/market-analysis/${update.slug}?t=${chapter.seconds}`}>{categoryLabel(chapter.market!)} <span aria-hidden="true">→</span></Link>)}</nav> : null}
  </section>;
}
export function MarketInsightLibrary({ updates, authors = {}, initialMarket = "all" }: { updates: FeedUpdate[]; authors?: FeedAuthors; initialMarket?: FeedMarket }) {
  const [view, setView] = useState<FeedView>("current");
  const [market, setMarket] = useState<FeedMarket>(initialMarket);
  const [content, setContent] = useState<FeedContent>("all");
  const [status, setStatus] = useState<"all" | SetupStatus>("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const expiration = updates.flatMap((update) => {
      const structure = getUpdateStructure(update);
      return [structure?.pin_until, structure?.urgent_until].filter((value): value is string => Boolean(value)).map(Date.parse);
    }).filter((value) => value > now).sort((a, b) => a - b)[0];
    if (!expiration) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(expiration - now + 50, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [updates, now]);
  const markets = useMemo(() => availableFeedMarkets(updates), [updates]);
  const filtered = filterMarketFeed(updates, { view, content, market, search, status });
  const pinnedIds = updates.filter((update) => update.actuality_status !== "archive" && isPinnedUpdate(update, now)).sort((a, b) => (getUpdateStructure(a)?.pinned_rank ?? 3) - (getUpdateStructure(b)?.pinned_rank ?? 3)).slice(0, 2).map((update) => update.id);
  const hero = view === "current" && content === "all" ? latestWeeklyOutlook(filtered) : undefined;
  const rows = filtered.filter((update) => update.id !== hero?.id).sort((a, b) => {
    const rank = (id: number) => pinnedIds.includes(id) ? pinnedIds.indexOf(id) : 3;
    return rank(a.id) - rank(b.id);
  });
  const filtersActive = market !== "all" || content !== "all" || Boolean(search.trim()) || (view === "open" && status !== "all");
  const reset = () => { setView("current"); setMarket("all"); setContent("all"); setSearch(""); setStatus("all"); };
  return <section className={styles.library} aria-label="Updates">
    <nav className={styles.views} aria-label="Updateoverzicht">{views.map((option) => <button key={option.value} type="button" aria-pressed={view === option.value} onClick={() => { setView(option.value); setStatus("all"); }} className={styles.view}>{option.label}</button>)}</nav>
    <div className={styles.filters}>
      <label className={styles.search}><span>Zoeken</span><div className={styles.searchControl}><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titel of samenvatting" /></div></label>
      <label><span>Inhoud</span><select value={content} onChange={(event) => setContent(event.target.value as FeedContent)}><option value="all">Alles</option><option value="text">Tekst &amp; charts</option><option value="video">Video</option></select></label>
      {view === "open" ? <label><span>Setupstatus</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | SetupStatus)}><option value="all">Alle statussen</option>{SETUP_STATUS_OPTIONS.filter((option) => option.value !== "closed").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
    </div>
    {markets.length >= 2 ? <nav className={styles.chips} aria-label="Filter op markt"><button type="button" aria-pressed={market === "all"} onClick={() => setMarket("all")}>Alle markten</button>{markets.map((value) => <button key={value} type="button" aria-pressed={market === value} onClick={() => setMarket(value)}>{categoryLabel(value)}</button>)}</nav> : null}
    {hero ? <WeeklyHero update={hero} now={now} /> : null}
    <div className={styles.listHeading}><h2>{hero ? "Marktinzichten" : views.find((option) => option.value === view)?.label}</h2>{filtersActive ? <button type="button" onClick={reset} className={styles.reset}>Toon alle updates</button> : null}</div>
    <p className="sr-only" role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? "bericht gevonden" : "berichten gevonden"}.</p>
    {filtered.length ? <><div className={styles.rows}>{rows.map((update) => <MarketUpdateCard key={update.id} update={update} author={authors[update.id]} pinned={pinnedIds.includes(update.id)} urgent={view !== "archive" && isUrgentUpdate(update, now)} />)}</div>
      {filtered.length <= 2 ? <p className={styles.continuation}>Je bent bij met deze selectie. {filtersActive ? <button type="button" onClick={reset}>Bekijk alle marktinzichten</button> : "Nieuwe inzichten verschijnen hier zodra ze gepubliceerd zijn."}</p> : null}</> : <div className={styles.empty}>
      <h3>{filtersActive ? "Geen updates gevonden" : view === "open" ? "Geen open setups" : view === "archive" ? "Het archief is nog leeg" : "Nog geen actuele updates"}</h3>
      <p>{filtersActive ? "Probeer een ander zoekwoord of bekijk alle updates." : view === "open" ? "Setups die wachten op een entry of nog lopen verschijnen hier." : "Nieuwe updates verschijnen hier zodra ze gepubliceerd zijn."}</p>
      <button type="button" onClick={reset} className="cb-btn cb-btn-secondary">Toon alle updates</button>
    </div>}
  </section>;
}
