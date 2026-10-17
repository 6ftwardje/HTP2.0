import type { WeeklyUpdate } from "@/lib/types";
import { CATEGORY_OPTIONS, getUpdateMarkets, getUpdateStructure, isOpenSetup, marketUpdateActivityAt, matchesUpdateMarket, type SetupStatus, type UpdateCategory } from "@/lib/market-update-structure";
import { marketPlainText } from "@/lib/market-editorial";

export type FeedUpdate = WeeklyUpdate & { mentor: { id: string; name: string | null } | null };
/** The client feed needs the credited display identity, never a mentor's email. */
export function projectMarketFeedUpdates(updates: readonly FeedUpdate[]): FeedUpdate[] {
  return updates.map((update) => ({ ...update, mentor: update.mentor ? { id: update.mentor.id, name: update.mentor.name } : null }));
}
export const MIN_ITEMS_FOR_FILTERS = 0;
export type FeedView = "current" | "open" | "archive";
export type FeedContent = "all" | "text" | "video";
export type FeedMarket = "all" | UpdateCategory;
export function updateSummary(update: WeeklyUpdate) {
  const candidates = [update.summary, update.intro, update.body, update.article_html].map(marketPlainText);
  return candidates.find((text) => text && text.toLocaleLowerCase("nl-BE") !== update.title.trim().toLocaleLowerCase("nl-BE")) || "Open deze update voor de volledige toelichting.";
}
export function accessibleFeedItems<T extends WeeklyUpdate>(updates: readonly T[]): T[] {
  return updates.filter((item) => item.is_published && item.type !== "live_session");
}
export function availableFeedMarkets(updates: readonly WeeklyUpdate[], threshold = MIN_ITEMS_FOR_FILTERS) {
  const counts = new Map<UpdateCategory, number>();
  for (const update of accessibleFeedItems(updates)) for (const market of getUpdateMarkets(update)) counts.set(market, (counts.get(market) ?? 0) + 1);
  return CATEGORY_OPTIONS.filter(({ value }) => (counts.get(value) ?? 0) > threshold).map(({ value }) => value);
}
export function filterMarketFeed<T extends WeeklyUpdate>(updates: readonly T[], filters: { view: FeedView; content: FeedContent; market: FeedMarket; search: string; status: "all" | SetupStatus }): T[] {
  const needle = filters.search.trim().toLocaleLowerCase("nl-BE");
  return accessibleFeedItems(updates).filter((update) => {
    if (filters.view === "archive" ? update.actuality_status !== "archive" : update.actuality_status === "archive") return false;
    if (filters.view === "open" && !isOpenSetup(update)) return false;
    const video = update.content_format === "video" && update.content_kind !== "article";
    if (filters.content !== "all" && (filters.content === "video") !== video) return false;
    if (filters.market !== "all" && !matchesUpdateMarket(update, filters.market)) return false;
    if (filters.view === "open" && filters.status !== "all" && getUpdateStructure(update)?.setup_status !== filters.status) return false;
    return !needle || [update.title, updateSummary(update)].join(" ").toLocaleLowerCase("nl-BE").includes(needle);
  }).sort((a, b) => Date.parse(marketUpdateActivityAt(b)) - Date.parse(marketUpdateActivityAt(a)) || b.id - a.id);
}
const publicationTime = (update: WeeklyUpdate) => Date.parse(update.published_at ?? update.created_at) || 0;
export function latestWeeklyOutlook<T extends WeeklyUpdate>(updates: readonly T[]): T | undefined {
  return accessibleFeedItems(updates).filter((update) => update.type === "weekly_outlook" && update.actuality_status !== "archive")
    .sort((a, b) => (b.week_start_date ?? "").localeCompare(a.week_start_date ?? "") || publicationTime(b) - publicationTime(a) || b.id - a.id)[0];
}
/** All candidates must already have passed the viewer's access gate. Never broadens access. */
export function followingMarketUpdates<T extends WeeklyUpdate>(current: WeeklyUpdate, candidates: readonly T[]): T[] {
  const updates = accessibleFeedItems(candidates).filter((item) => item.id !== current.id && item.type !== "weekly_outlook")
    .sort((a, b) => publicationTime(a) - publicationTime(b) || a.id - b.id);
  const newer = updates.find((item) => publicationTime(item) > publicationTime(current) || (publicationTime(item) === publicationTime(current) && item.id > current.id));
  const next = newer ?? updates.at(-1);
  const outlook = current.type === "weekly_outlook"
    ? updates.filter((item) => item.id !== next?.id).at(-1)
    : latestWeeklyOutlook(candidates.filter((item) => item.id !== current.id));
  return [next, outlook].filter((item): item is T => Boolean(item)).filter((item, index, items) => items.findIndex((other) => other.id === item.id) === index);
}
export function brusselsWeekStart(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((value) => value.type === type)?.value);
  const day = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function outlookPeriod(update: WeeklyUpdate, now = new Date()) {
  const week = brusselsWeekStart(now);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(update.week_start_date) ? new Date(`${update.week_start_date}T12:00:00Z`) : null;
  const period = update.period_label?.trim() || (date && Number.isFinite(date.getTime()) ? `Week van ${date.toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Brussels" })}` : "Weekvooruitblik");
  return { period, label: update.week_start_date < week ? "Eerdere weekvooruitblik" : update.week_start_date > week ? "Komende weekvooruitblik" : "Deze week" };
}
