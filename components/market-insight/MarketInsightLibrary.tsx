"use client";

import { RelativeDate } from "@/components/ui/RelativeDate";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { MarketTag, marketTagMarket } from "@/components/ui/MarketTag";
import type { Market, WeeklyUpdate } from "@/lib/types";
import { marketUpdateAuthorName } from "@/lib/market-update-author";
import {
  CATEGORY_OPTIONS, UPDATE_TYPE_OPTIONS, SETUP_STATUS_OPTIONS,
  categoryLabel, updateTypeLabel, setupStatusLabel, getUpdateStructure,
  getUpdateMarkets, matchesUpdateMarket, isOpenSetup, marketUpdateActivityAt, isPinnedUpdate, isUrgentUpdate,
  type UpdateCategory, type UpdateType, type SetupStatus,
} from "@/lib/market-update-structure";
import styles from "./MarketInsightLibrary.module.css";

type Update = WeeklyUpdate & {
  mentor: { id: string; name: string | null; email: string } | null;
};
type View = "current" | "open" | "archive";
type ContentFilter = "all" | "updates" | "weekly_outlook";
type CategoryFilter = "all" | UpdateCategory | "macro";

const views: Array<{ value: View; label: string }> = [
  { value: "current", label: "Actueel" },
  { value: "open", label: "Open setups" },
  { value: "archive", label: "Archief" },
];

function plainText(value: string | null | undefined) {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function updateSummary(update: Update) {
  return plainText(getUpdateStructure(update) ? update.summary : update.summary || update.intro || update.body);
}

function UpdateRow({ update, pinned, urgent }: { update: Update; pinned: boolean; urgent: boolean }) {
  const structure = getUpdateStructure(update);
  const weekly = update.type === "weekly_outlook";
  const publishedAt = update.published_at ?? update.created_at;
  const activityAt = marketUpdateActivityAt(update);
  const updated = Boolean(structure && new Date(activityAt).getTime() > new Date(publishedAt).getTime());
  const summary = updateSummary(update);
  const href = `/market-analysis/${update.slug}`;
  const video = update.content_format === "video" && update.content_kind !== "article";
  const chart = update.content_format === "chart" && Boolean(update.image_paths?.length);
  const thumbnail = chart ? `/api/market-updates/${update.id}/images/0` : update.thumbnail_url;
  const showThumbnail = video || chart || Boolean(thumbnail);
  const categories = getUpdateMarkets(update).map(categoryLabel);
  const reached = structure?.targets.filter((target) => Boolean(target.reached_at)).length ?? 0;
  const setupMeta = structure?.type === "setup"
    ? [structure.fields.instrument, structure.fields.direction === "long" ? "Long" : structure.fields.direction === "short" ? "Short" : structure.fields.direction, structure.fields.timeframe].filter(Boolean)
    : [];

  return <Link href={href} className={styles.row} aria-label={update.title}>
    <div className={styles.rowMain}>
      <div className={styles.labels}>
        {categories.map((label) => {
          const market = marketTagMarket(label);
          return market ? <MarketTag key={label} market={market}>{label}</MarketTag> : <span key={label}>{label}</span>;
        })}
        <span className={styles.type}>{weekly ? "Weekvooruitblik" : structure ? updateTypeLabel(structure.type) : "Marktupdate"}</span>
        {pinned ? <span className={styles.flag}><PinIcon />Vastgezet</span> : null}
        {urgent ? <span className={styles.flag}>Urgent</span> : null}
      </div>
      <h3 className={styles.title}>{update.title}</h3>
      {summary && summary.toLocaleLowerCase("nl-BE") !== update.title.trim().toLocaleLowerCase("nl-BE") ? <p className={styles.summary}>{summary}</p> : null}
      {structure?.type === "setup" ? <div className={styles.setup}>
        {setupMeta.length ? <span className={styles.instrument}>{setupMeta.join(" · ")}</span> : null}
        {structure.setup_status ? <span className={styles.status} data-status={structure.setup_status}>{setupStatusLabel(structure.setup_status)}</span> : null}
        {structure.targets.length ? <span>{reached} van {structure.targets.length} doelen bereikt</span> : null}
      </div> : null}
      <p className={styles.byline}>
        <span>{marketUpdateAuthorName(update)}</span>
        <RelativeDate value={publishedAt} focusable={false} />
        {video ? <span>Video{update.video_duration_seconds ? ` · ${Math.max(1, Math.round(update.video_duration_seconds / 60))} min` : ""}</span> : chart ? <span>Grafiek</span> : null}
      </p>
      {updated ? <p className={styles.updated}>Bijgewerkt <RelativeDate value={activityAt} focusable={false} /></p> : null}
      <span className={styles.open}>Open {weekly ? "vooruitblik" : "update"}<ArrowIcon /></span>
    </div>
    {showThumbnail ? <div className={styles.thumbnail}>
      {chart ? <img src={thumbnail ?? ""} alt="" loading="lazy" /> : <CourseThumbnail src={thumbnail} title={update.title} className={styles.thumbnailImage} sizes="(max-width: 640px) 104px, 180px" />}
      {video ? <span className={styles.play}><PlayIcon /><span className="sr-only">Video</span></span> : null}
    </div> : null}
  </Link>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PinIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m12 3 5 5-3 1-3 4-4-4 4-3 1-3ZM9 11l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 5 8 5-8 5V5Z" fill="currentColor" /></svg>;
}

export function MarketInsightLibrary({ updates, initialMarket = "all" }: { updates: Update[]; initialMarket?: Market | CategoryFilter }) {
  const [view, setView] = useState<View>("current");
  const [category, setCategory] = useState<CategoryFilter>(initialMarket);
  const [type, setType] = useState<"all" | UpdateType>("all");
  const [status, setStatus] = useState<"all" | SetupStatus>("all");
  const [content, setContent] = useState<ContentFilter>("all");
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
  const items = useMemo(() => updates.filter((update) => update.type !== "live_session").sort((a, b) =>
    new Date(marketUpdateActivityAt(b)).getTime() - new Date(marketUpdateActivityAt(a)).getTime() || b.id - a.id
  ), [updates]);
  const pinnedIds = items.filter((update) => update.actuality_status !== "archive" && isPinnedUpdate(update, now))
    .sort((a, b) => (getUpdateStructure(a)?.pinned_rank ?? 3) - (getUpdateStructure(b)?.pinned_rank ?? 3))
    .slice(0, 2).map((update) => update.id);
  const needle = search.trim().toLocaleLowerCase("nl-BE");
  const filtered = items.filter((update) => {
    const structure = getUpdateStructure(update);
    const archived = update.actuality_status === "archive";
    if (view === "archive" ? !archived : archived) return false;
    if (view === "open" && !isOpenSetup(update)) return false;
    if (content === "weekly_outlook" && update.type !== "weekly_outlook") return false;
    if (content === "updates" && update.type === "weekly_outlook") return false;
    if (category !== "all") {
      const matchesCategory = matchesUpdateMarket(update, category);
      if (!matchesCategory) return false;
    }
    if (type !== "all" && (update.type === "weekly_outlook" || structure?.type !== type)) return false;
    if ((type === "setup" || view === "open") && status !== "all" && structure?.setup_status !== status) return false;
    if (needle) {
      const text = [update.title, updateSummary(update), plainText(update.body), plainText(update.article_html), marketUpdateAuthorName(update), ...Object.values(structure?.fields ?? {}), ...(structure?.targets.map((target) => target.label) ?? [])].join(" ").toLocaleLowerCase("nl-BE");
      if (!text.includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => {
    const aPin = pinnedIds.indexOf(a.id);
    const bPin = pinnedIds.indexOf(b.id);
    return (aPin < 0 ? 3 : aPin) - (bPin < 0 ? 3 : bPin);
  });
  const filtersActive = category !== "all" || type !== "all" || content !== "all" || Boolean(search.trim()) || (view === "open" && status !== "all");
  const reset = () => { setCategory("all"); setType("all"); setStatus("all"); setContent("all"); setSearch(""); };

  return <section className={styles.library} aria-label="Updates">
    <nav className={styles.views} aria-label="Updateoverzicht">
      {views.map((option) => <button key={option.value} type="button" aria-pressed={view === option.value} onClick={() => { setView(option.value); setStatus("all"); if (option.value === "open") { setType("all"); setContent("all"); } }} className={styles.view}>{option.label}</button>)}
    </nav>
    <div className={styles.filters}>
      <label className={styles.search}><span>Zoeken</span><div className={styles.searchControl}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Onderwerp of instrument" /></div></label>
      <label><span>Categorie</span><select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}><option value="all">Alle categorieën</option>{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {view !== "open" ? <label><span>Type</span><select value={type} onChange={(event) => { setType(event.target.value as "all" | UpdateType); setStatus("all"); }}><option value="all">Alle types</option>{UPDATE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
      {view !== "open" ? <label><span>Inhoud</span><select value={content} onChange={(event) => setContent(event.target.value as ContentFilter)}><option value="all">Alle inhoud</option><option value="updates">Updates</option><option value="weekly_outlook">Weekvooruitblikken</option></select></label> : null}
      {type === "setup" || view === "open" ? <label><span>Setupstatus</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | SetupStatus)}><option value="all">Alle statussen</option>{SETUP_STATUS_OPTIONS.filter((option) => view !== "open" || option.value !== "closed").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
    </div>
    <div className={styles.listHeading}>
      <h2>{views.find((option) => option.value === view)?.label}<span>{filtered.length} {filtered.length === 1 ? "bericht" : "berichten"}</span></h2>
      {filtersActive ? <button type="button" onClick={reset} className={styles.reset}>Filters wissen</button> : null}
    </div>
    <p className="sr-only" role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? "bericht gevonden" : "berichten gevonden"}.</p>
    {filtered.length ? <div>{filtered.map((update) => <UpdateRow key={update.id} update={update} pinned={pinnedIds.includes(update.id)} urgent={view !== "archive" && isUrgentUpdate(update, now)} />)}</div> : <div className={styles.empty}>
      <h3>{filtersActive ? "Geen updates gevonden" : view === "open" ? "Geen open setups" : view === "archive" ? "Het archief is nog leeg" : "Nog geen actuele updates"}</h3>
      <p>{filtersActive ? "Probeer een ander zoekwoord of pas je filters aan." : view === "open" ? "Setups die wachten op een entry of nog lopen verschijnen hier." : view === "archive" ? "Gearchiveerde updates blijven hier terug te vinden." : "Nieuwe updates verschijnen hier zodra ze gepubliceerd zijn."}</p>
      {filtersActive ? <button type="button" onClick={reset} className="cb-btn cb-btn-secondary">Filters wissen</button> : null}
    </div>}
  </section>;
}
