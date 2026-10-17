import { fromZonedTime } from "date-fns-tz";
import { RelativeDate } from "@/components/ui/RelativeDate";
import type { ReactNode } from "react";
import type { WeeklyUpdate } from "@/lib/types";
import {
  getUpdateStructure, setupStatusLabel, closeReasonLabel, isPinnedUpdate, isUrgentUpdate,
  marketUpdateActivityAt, TEMPLATE_FIELDS,
  type MarketUpdateStructure, type TemplateField, type UpdateHistoryEntry, type UpdateSnapshot,
} from "@/lib/market-update-structure";
import styles from "./MarketUpdateStructureContent.module.css";
import { structureFallbackBody } from "@/lib/market-update-editing";

const historyLabels: Record<UpdateHistoryEntry["kind"], string> = {
  published: "Gepubliceerd", follow_up: "Opvolging", entry: "Entry bereikt",
  target: "Doel bereikt", closed: "Afgesloten", correction: "Correctie",
};

function dateLabel(value: string) {
  // Template dates without an offset are entered in the platform's local time.
  const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? new Date(value) : fromZonedTime(value, "Europe/Brussels");
  if (!Number.isFinite(date.getTime())) return "Datum onbekend";
  return new Intl.DateTimeFormat("nl-BE", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels",
  }).format(date);
}

function FieldValue({ field, value }: { field: TemplateField; value: string }) {
  if (field.type === "url") {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) return <>{value}</>;
      return <a href={url.href} target="_blank" rel="noopener noreferrer">Lees de bron op {url.hostname.replace(/^www\./, "")}<span className="sr-only"> (opent in een nieuw tabblad)</span></a>;
    } catch { return <>{value}</>; }
  }
  if (field.type === "datetime-local") return <time dateTime={value}>{dateLabel(value)}</time>;
  if (field.key === "direction") return <>{value === "long" ? "Long" : value === "short" ? "Short" : value}</>;
  return <>{value}</>;
}

function TemplateValues({ structure, snapshot, showHelp = true }: { structure: MarketUpdateStructure; snapshot?: UpdateSnapshot; showHelp?: boolean }) {
  const values = snapshot ?? structure;
  const fields = TEMPLATE_FIELDS[structure.type].filter((field) => field.key !== "review_at" && values.fields[field.key]?.trim());
  return <dl className={styles.fields}>
    {fields.map((field) => <div key={field.key} className={field.multiline || field.type === "url" ? styles.fullField : styles.field}>
      <dt>{field.label}</dt>
      <dd><FieldValue field={field} value={values.fields[field.key]} /></dd>
      {showHelp && field.key === "invalidation" && structure.type === "setup" ? <p className={styles.help}>Wanneer deze voorwaarde bereikt is, vervalt het scenario.</p> : null}
    </div>)}
  </dl>;
}

function Targets({ targets, compact = false }: { targets: MarketUpdateStructure["targets"]; compact?: boolean }) {
  if (!targets.length) return null;
  return <ol className={compact ? styles.compactTargets : styles.targets}>
    {targets.map((target, index) => <li key={index}>
      <span className={styles.targetName}>Doel {index + 1}</span>
      <span className={styles.targetValue}>{target.label}</span>
      <span className={styles.targetStatus}>{target.reached_at ? <>Bereikt{!compact ? <RelativeDate value={target.reached_at} /> : null}</> : "Open"}</span>
    </li>)}
  </ol>;
}

export function MarketUpdateStructureContent({ update, children }: { update: WeeklyUpdate; children?: ReactNode }) {
  const structure = getUpdateStructure(update);
  if (!structure) return <>{children}</>;
  const publishedAt = update.published_at ?? update.created_at;
  const activityAt = marketUpdateActivityAt(update);
  const updated = Date.parse(activityAt) > Date.parse(publishedAt);
  const history = [...structure.history].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return <div className={styles.content}>
    {isPinnedUpdate(update) || isUrgentUpdate(update) || updated ? <div className={styles.metadata}>
      {isPinnedUpdate(update) ? <span>Vastgezet</span> : null}
      {isUrgentUpdate(update) ? <span>Urgent</span> : null}
      {updated ? <span>Inhoudelijk bijgewerkt <RelativeDate value={activityAt} /></span> : null}
    </div> : null}
    {update.summary?.trim() ? <p className={styles.summary}>{update.summary}</p> : null}
    {structure.type === "setup" ? <section className={styles.setupState} aria-label="Setupvoortgang">
      <p className={styles.status}>{setupStatusLabel(structure.setup_status)}{structure.setup_status === "closed" && structure.close_reason ? <span> · {closeReasonLabel(structure.close_reason)}</span> : null}</p>
      {structure.closed_at ? <p className={styles.closedAt}>Afgesloten op <RelativeDate value={structure.closed_at} /></p> : null}
    </section> : null}
    <TemplateValues structure={structure} />
    {structure.type === "setup" && structure.targets.length ? <section className={styles.targetSection} aria-labelledby={`setup-targets-${update.id}`}>
      <h2 id={`setup-targets-${update.id}`}>Doelen</h2>
      <Targets targets={structure.targets} />
    </section> : null}
    {children}
    {history.length ? <section className={styles.history} aria-labelledby={`update-history-${update.id}`}>
      <h2 id={`update-history-${update.id}`}>Opvolging</h2>
      <ol className={styles.timeline}>
        {history.map((entry) => <li key={entry.id}>
          <div className={styles.historyHeading}><h3>{historyLabels[entry.kind]}</h3><RelativeDate value={entry.at} /></div>
          <p className={styles.historyAuthor}>{entry.author}</p>
          {entry.note.trim() ? <p className={styles.historyNote}>{entry.note}</p> : null}
          {entry.snapshot ? <details className={styles.snapshot}>
            <summary>{entry.kind === "published" ? "Waarden bij publicatie" : "Waarden vóór deze wijziging"}</summary>
            {entry.snapshot.setup_status ? <p className={styles.snapshotStatus}>{setupStatusLabel(entry.snapshot.setup_status)}{entry.snapshot.close_reason ? ` · ${closeReasonLabel(entry.snapshot.close_reason)}` : ""}</p> : null}
            {entry.snapshot.title || entry.snapshot.summary ? <dl className={styles.fields}>
              {entry.snapshot.title ? <div className={styles.fullField}><dt>Titel</dt><dd>{entry.snapshot.title}</dd></div> : null}
              {entry.snapshot.summary ? <div className={styles.fullField}><dt>Kernboodschap</dt><dd>{entry.snapshot.summary}</dd></div> : null}
            </dl> : null}
            <TemplateValues structure={structure} snapshot={entry.snapshot} showHelp={false} />
            <Targets targets={entry.snapshot.targets} compact />
            {entry.snapshot.body?.trim() && entry.snapshot.body !== structureFallbackBody({ ...structure, ...entry.snapshot }, entry.snapshot.summary ?? update.summary) ? <div className={styles.snapshotBody}><h4>Aanvullende toelichting</h4><p>{entry.snapshot.body}</p></div> : null}
          </details> : null}
        </li>)}
      </ol>
    </section> : null}
  </div>;
}
