import Link from "next/link";
import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { RelativeDate } from "@/components/ui/RelativeDate";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { MarketTag, marketTagMarket } from "@/components/ui/MarketTag";
import type { FeedUpdate } from "@/lib/market-feed";
import type { FeedAuthor } from "@/lib/market-feed-authors";
import { marketUpdateAuthorName } from "@/lib/market-update-author";
import { updateSummary } from "@/lib/market-feed";
import { categoryLabel, getUpdateMarkets, getUpdateStructure, marketUpdateActivityAt, setupStatusLabel, updateTypeLabel } from "@/lib/market-update-structure";
import styles from "./MarketUpdateCard.module.css";

export function MarketUpdateCard({ update, author, compact = false, pinned = false, urgent = false }: {
  update: FeedUpdate; author?: FeedAuthor; compact?: boolean; pinned?: boolean; urgent?: boolean;
}) {
  const structure = getUpdateStructure(update);
  const markets = getUpdateMarkets(update);
  const firstMarket = marketTagMarket(markets[0] ?? "");
  const video = update.content_format === "video" && update.content_kind !== "article";
  const chart = update.content_format === "chart" && Boolean(update.image_paths?.length);
  const thumbnail = chart ? `/api/market-updates/${update.id}/images/0` : update.thumbnail_url;
  const name = author?.name ?? marketUpdateAuthorName(update);
  const publishedAt = update.published_at ?? update.created_at;
  const activityAt = marketUpdateActivityAt(update);
  const updated = Boolean(structure && Date.parse(activityAt) > Date.parse(publishedAt));
  const weekly = update.type === "weekly_outlook";
  return <Link href={`/market-analysis/${update.slug}`} className={styles.card} data-compact={compact || undefined} data-update-id={update.id}
    style={{ "--card-market": firstMarket ? `var(--market-${firstMarket})` : "var(--border)" } as CSSProperties} aria-label={update.title}>
    <div className={styles.media}>
      <CourseThumbnail src={thumbnail} videoRef={video?{kind:"update",id:update.id}:undefined} unoptimized={chart} showImageShade={!chart} title={update.title} className={styles.image} imageClassName="!object-contain" sizes={compact ? "(min-width: 1024px) 33vw, 100vw" : "(min-width: 768px) 42vw, 100vw"} />
      {video ? <span className={styles.play} aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor" /></svg></span> : null}
      {video && update.video_duration_seconds ? <span className={styles.duration}>{Math.max(1, Math.round(update.video_duration_seconds / 60))} min</span> : null}
    </div>
    <div className={styles.body}>
      <div className={styles.top}><span className={styles.type}>{weekly ? "Weekvooruitblik" : structure ? updateTypeLabel(structure.type) : video ? "Video" : chart ? "Chartupdate" : "Tekstupdate"}</span>
        <div className={styles.tags}>{markets.map((market) => marketTagMarket(market) ? <MarketTag key={market} market={marketTagMarket(market)!}>{categoryLabel(market)}</MarketTag> : <span key={market}>{categoryLabel(market)}</span>)}</div>
      </div>
      {pinned || urgent ? <p className={styles.flags}>{[pinned ? "Vastgezet" : null, urgent ? "Urgent" : null].filter(Boolean).join(" · ")}</p> : null}
      <h3 className={styles.title}>{update.title}</h3>
      <p className={styles.summary}>{updateSummary(update)}</p>
      {structure?.type === "setup" ? <p className={styles.setup}>{[structure.fields.instrument, structure.fields.direction, structure.fields.timeframe, structure.setup_status ? setupStatusLabel(structure.setup_status) : null].filter(Boolean).join(" · ")}{structure.targets.length ? ` · ${structure.targets.filter((target) => target.reached_at).length} van ${structure.targets.length} doelen bereikt` : ""}</p> : null}
      <div className={styles.byline}><Avatar name={name} objectPath={author?.object_path} studentId={author?.student_id} size={32} /><div><span className={styles.name}>{name}</span><span className={styles.date}><RelativeDate value={publishedAt} focusable={false} /></span></div></div>
      {updated ? <p className={styles.updated}>Bijgewerkt <RelativeDate value={activityAt} focusable={false} /></p> : null}
      <span className={styles.open}>Open {weekly ? "vooruitblik" : "update"} <span aria-hidden="true">→</span></span>
    </div>
  </Link>;
}
