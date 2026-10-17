import type { UpdateMarket } from "@/lib/types";
import { MARKET_OPTIONS } from "@/lib/market-analysis";

/** Metadata used only by the market-update rubric; legacy updates keep their original shape. */
export type UpdateCategory = UpdateMarket;
export type UpdateType = "setup" | "analysis" | "news" | "education";
export type UpdatePerspective = "technical" | "fundamental" | "combined";
export type SetupStatus = "waiting" | "running" | "closed";
export type SetupCloseReason = "targets" | "stopped" | "cancelled" | "expired" | "manual";
export type UpdateTarget = { label: string; reached_at: string | null };
export type UpdateSnapshot = {
  fields: Record<string, string>;
  targets: UpdateTarget[];
  setup_status: SetupStatus | null;
  close_reason: SetupCloseReason | null;
};
export type UpdateHistoryEntry = {
  id: string;
  at: string;
  author: string;
  kind: "published" | "follow_up" | "entry" | "target" | "closed" | "correction";
  note: string;
  snapshot?: UpdateSnapshot & { title?: string; summary?: string | null; body?: string | null };
};
export type MarketUpdateStructure = UpdateSnapshot & {
  version: 1;
  category: UpdateCategory;
  type: UpdateType;
  perspective: UpdatePerspective | null;
  closed_at: string | null;
  history: UpdateHistoryEntry[];
  pinned_rank: 1 | 2 | null;
  pin_until: string | null;
  urgent_until: string | null;
  activity_at: string | null;
};

/** `category` is the version-1 compatibility label, never the complete market list. */
export const CATEGORY_OPTIONS = [
  ...MARKET_OPTIONS,
  { value: "macro", label: "Macro" },
  { value: "indices", label: "Indices" },
  { value: "general", label: "Algemeen" },
] as const;
export const isUpdateMarket = (value: unknown): value is UpdateMarket =>
  typeof value === "string" && CATEGORY_OPTIONS.some((option) => option.value === value);

export const UPDATE_TYPE_OPTIONS = [
  { value: "setup", label: "Setup" },
  { value: "analysis", label: "Analyse" },
  { value: "news", label: "Nieuws" },
  { value: "education", label: "Educatie" },
] as const;
export const PERSPECTIVE_OPTIONS = [
  { value: "technical", label: "Technisch" },
  { value: "fundamental", label: "Fundamenteel" },
  { value: "combined", label: "Gecombineerd" },
] as const;
export const SETUP_STATUS_OPTIONS = [
  { value: "waiting", label: "Wacht op entry" },
  { value: "running", label: "Lopend" },
  { value: "closed", label: "Afgesloten" },
] as const;
export const CLOSE_REASON_OPTIONS = [
  { value: "targets", label: "Doelen bereikt" },
  { value: "stopped", label: "Gestopt" },
  { value: "cancelled", label: "Geannuleerd" },
  { value: "expired", label: "Verlopen" },
  { value: "manual", label: "Afgerond door auteur" },
] as const;

export type TemplateField = {
  key: string;
  label: string;
  help?: string;
  required: boolean;
  multiline?: boolean;
  type?: "text" | "url" | "datetime-local";
};
export const TEMPLATE_FIELDS: Record<UpdateType, TemplateField[]> = {
  setup: [
    { key: "instrument", label: "Instrument", required: true, help: "Eén instrument per setup, bijvoorbeeld BTC/USD." },
    { key: "direction", label: "Richting", required: true, help: "Long of short." },
    { key: "timeframe", label: "Timeframe", required: true, help: "De grafiekperiode waarop het scenario gebaseerd is." },
    { key: "entry", label: "Beoogde entry / zone", required: true, help: "Het prijsniveau of gebied waarop je wacht." },
    { key: "entry_condition", label: "Entryvoorwaarde", required: true, multiline: true, help: "Wat moet gebeuren voordat dit scenario gaat lopen?" },
    { key: "invalidation", label: "Invalidatie", required: true, multiline: true, help: "Het niveau of de voorwaarde waardoor het scenario vervalt." },
    { key: "stop", label: "Stopniveau", required: false },
    { key: "rationale", label: "Onderbouwing", required: true, multiline: true },
    { key: "valid_until", label: "Geldig tot", required: false, type: "datetime-local" },
    { key: "review_at", label: "Opvolgen op", required: false, type: "datetime-local" },
  ],
  analysis: [
    { key: "instrument", label: "Markt / instrument", required: true },
    { key: "timeframe", label: "Timeframe / horizon", required: true },
    { key: "rationale", label: "Onderbouwing", required: true, multiline: true },
    { key: "invalidation", label: "Wat verandert deze visie?", required: true, multiline: true },
    { key: "levels", label: "Relevante niveaus", required: false, multiline: true },
    { key: "alternative", label: "Alternatief scenario", required: false, multiline: true },
    { key: "review_at", label: "Opvolgen op", required: false, type: "datetime-local" },
  ],
  news: [
    { key: "event", label: "Wat is gebeurd?", required: true, multiline: true },
    { key: "relevance", label: "Waarom is dit relevant?", required: true, multiline: true },
    { key: "impact", label: "Mogelijke betekenis voor de markt", required: true, multiline: true, help: "Maak duidelijk dat dit jullie interpretatie is." },
    { key: "source_url", label: "Bron", required: true, type: "url", help: "Een volledige link die begint met https:// of http://." },
    { key: "event_date", label: "Datum en tijd gebeurtenis", required: false, type: "datetime-local" },
  ],
  education: [
    { key: "learning_goal", label: "Leerdoel", required: true },
    { key: "explanation", label: "Uitleg", required: true, multiline: true },
    { key: "example", label: "Concreet voorbeeld", required: true, multiline: true },
    { key: "lesson", label: "Belangrijkste les", required: true, multiline: true },
  ],
};

export function emptyStructure(type: UpdateType = "analysis"): MarketUpdateStructure {
  return {
    version: 1,
    category: "general",
    type,
    perspective: null,
    fields: Object.fromEntries(TEMPLATE_FIELDS[type].map((field) => [field.key, ""])),
    targets: [],
    setup_status: type === "setup" ? "waiting" : null,
    close_reason: null,
    closed_at: null,
    history: [],
    pinned_rank: null,
    pin_until: null,
    urgent_until: null,
    activity_at: null,
  };
}

type UpdateLike = {
  update_structure?: unknown;
  market?: string | null;
  markets?: readonly string[] | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_published?: boolean;
  actuality_status?: string;
};

const hasOption = <T extends string>(options: readonly { value: T }[], value: unknown): value is T =>
  typeof value === "string" && options.some((option) => option.value === value);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[], optional: readonly string[] = []) =>
  keys.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys.includes(key) || optional.includes(key));

/** Accept ISO timestamps and HTML datetime-local values, rejecting rolled-over calendar dates. */
function validDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = parts;
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1
    && Number(day) <= new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second ?? 0) <= 59
    && Number(offsetHour ?? 0) <= 23 && Number(offsetMinute ?? 0) <= 59;
}
const nullableDate = (value: unknown) => value === null || validDate(value);
export const FIELD_LIMITS: Record<string, number> = {
  instrument: 120, direction: 5, timeframe: 120, entry: 1000, entry_condition: 2000,
  invalidation: 2000, stop: 1000, rationale: 8000, valid_until: 100, review_at: 100,
  levels: 4000, alternative: 4000, event: 8000, relevance: 4000, impact: 4000,
  source_url: 2000, event_date: 100, learning_goal: 2000, explanation: 12000,
  example: 6000, lesson: 2000,
};

function fieldsError(fields: unknown, type: UpdateType): string | null {
  if (!record(fields)) return "De sjabloonvelden zijn ongeldig.";
  const allowed = TEMPLATE_FIELDS[type].map((field) => field.key);
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key) || typeof value !== "string") return "De sjabloonvelden zijn ongeldig.";
    if (value.length > FIELD_LIMITS[key]) return `Het veld ${TEMPLATE_FIELDS[type].find((field) => field.key === key)!.label.toLowerCase()} is te lang.`;
    if (["valid_until", "review_at", "event_date"].includes(key) && value && !validDate(value)) return "Gebruik een geldige datum en tijd.";
    if (key === "direction" && value && !["long", "short"].includes(value)) return "Kies long of short als richting.";
    if (key === "source_url" && value) {
      try {
        const url = new URL(value);
        if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return "Gebruik een geldige http- of https-bronlink.";
      } catch { return "Gebruik een geldige http- of https-bronlink."; }
    }
  }
  return null;
}

function targetsValid(value: unknown): value is UpdateTarget[] {
  return Array.isArray(value) && value.length <= 3 && value.every((target) =>
    record(target) && exactKeys(target, ["label", "reached_at"])
    && typeof target.label === "string" && target.label.length <= 240 && target.label.trim().length > 0
    && nullableDate(target.reached_at));
}
const statusValid = (value: unknown) => value === null || hasOption(SETUP_STATUS_OPTIONS, value);
const reasonValid = (value: unknown) => value === null || hasOption(CLOSE_REASON_OPTIONS, value);

function structureError(value: unknown): string | null {
  if (!record(value) || !exactKeys(value, ["version", "category", "type", "perspective", "fields", "targets", "setup_status", "close_reason", "closed_at", "history", "pinned_rank", "pin_until", "urgent_until", "activity_at"])) return "De updatestructuur is ongeldig.";
  if (value.version !== 1 || !hasOption(CATEGORY_OPTIONS, value.category) || !hasOption(UPDATE_TYPE_OPTIONS, value.type)) return "Kies een geldige categorie en een geldig type.";
  if (value.perspective !== null && !hasOption(PERSPECTIVE_OPTIONS, value.perspective)) return "Kies een geldige invalshoek.";
  if (!["setup", "analysis"].includes(value.type) && value.perspective !== null) return "Een invalshoek is alleen beschikbaar bij setups en analyses.";
  const error = fieldsError(value.fields, value.type);
  if (error) return error;
  if (!targetsValid(value.targets) || !statusValid(value.setup_status) || !reasonValid(value.close_reason)) return "De setupvoortgang is ongeldig.";
  if (![value.closed_at, value.pin_until, value.urgent_until, value.activity_at].every(nullableDate)) return "Gebruik een geldige datum en tijd.";
  if (![null, 1, 2].includes(value.pinned_rank as null | number)) return "Er zijn maximaal twee vastgezette updates.";
  if (value.pinned_rank === null && value.pin_until !== null) return "Een einddatum voor vastzetten vereist een vastgezette update.";
  if (value.type === "setup") {
    if (value.setup_status === null) return "Kies een setupstatus.";
    if (value.setup_status === "closed" && (value.close_reason === null || value.closed_at === null)) return "Een afgesloten setup vereist een afsluitreden en afsluitdatum.";
    if (value.setup_status !== "closed" && (value.close_reason !== null || value.closed_at !== null)) return "Een open setup kan geen afsluitreden of afsluitdatum hebben.";
    if (value.setup_status === "waiting" && value.targets.some((target) => target.reached_at !== null)) return "Een setup die wacht op entry kan nog geen bereikte doelen hebben.";
    if (value.close_reason === "targets" && (value.targets.length === 0 || value.targets.some((target) => target.reached_at === null))) return "Markeer alle doelen als bereikt voordat je deze afsluitreden kiest.";
    if (["cancelled", "expired"].includes(value.close_reason as string) && value.targets.some((target) => target.reached_at !== null)) return "Een geannuleerde of verlopen setup kan geen bereikte doelen hebben.";
  } else if (value.setup_status !== null || value.close_reason !== null || value.closed_at !== null || value.targets.length > 0) return "Alleen setups hebben een setupstatus en doelen.";
  if (!Array.isArray(value.history)) return "De opvolging is ongeldig.";
  const ids = new Set<string>();
  for (const entry of value.history) {
    if (!record(entry) || !exactKeys(entry, ["id", "at", "author", "kind", "note"], ["snapshot"])
      || typeof entry.id !== "string" || !entry.id || entry.id.length > 120 || ids.has(entry.id)
      || !validDate(entry.at) || typeof entry.author !== "string" || !entry.author.trim() || entry.author.length > 200
      || !["published", "follow_up", "entry", "target", "closed", "correction"].includes(entry.kind as string)
      || typeof entry.note !== "string" || entry.note.length > 4000) return "De opvolging is ongeldig.";
    ids.add(entry.id);
    if (entry.snapshot !== undefined) {
      const snapshot = entry.snapshot;
      if (!record(snapshot) || !exactKeys(snapshot, ["fields", "targets", "setup_status", "close_reason"], ["title", "summary", "body"])
        || fieldsError(snapshot.fields, value.type) || !targetsValid(snapshot.targets)
        || !statusValid(snapshot.setup_status) || !reasonValid(snapshot.close_reason)
        || (snapshot.title !== undefined && (typeof snapshot.title !== "string" || snapshot.title.length > 1000))
        || (snapshot.summary !== undefined && snapshot.summary !== null && (typeof snapshot.summary !== "string" || snapshot.summary.length > 12000))
        || (snapshot.body !== undefined && snapshot.body !== null && (typeof snapshot.body !== "string" || snapshot.body.length > 12000))) return "De oorspronkelijke waarden in de opvolging zijn ongeldig.";
    }
  }
  return null;
}

export function getUpdateStructure(update: Pick<UpdateLike, "update_structure"> | null | undefined): MarketUpdateStructure | null {
  return update?.update_structure != null && !structureError(update.update_structure)
    ? update.update_structure as MarketUpdateStructure : null;
}

/** Lossless read projection across old rows, including contradictory historical labels.
 * New writes submit the full array and maintain the primary compatibility label.
 * General on an old multi-market record is an umbrella, not a replacement for its tags.
 */
export function getUpdateMarkets(update: UpdateLike | null | undefined): UpdateMarket[] {
  if (!update) return [];
  const values: unknown[] = [...(update.markets ?? []), update.market];
  const category = getUpdateStructure(update)?.category;
  if (category && (category !== "general" || !values.some(isUpdateMarket))) values.push(category);
  return [...new Set(values.filter(isUpdateMarket))];
}

export function matchesUpdateMarket(update: UpdateLike, market: string): boolean {
  return getUpdateMarkets(update).some((value) => value === market);
}

/** Only legacy callers need a single label. Filtering/rendering uses getUpdateMarkets. */
export function getUpdateCategory(update: UpdateLike): UpdateCategory | null {
  const structure = getUpdateStructure(update);
  if (structure) return structure.category;
  const markets = getUpdateMarkets(update);
  return markets.length > 1 || markets[0] === "macro" ? "general" : markets[0] ?? null;
}

export const categoryLabel = (value: string | null | undefined) => CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? "Nog indelen";
export const updateTypeLabel = (value: string | null | undefined) => UPDATE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Nog indelen";
export const setupStatusLabel = (value: string | null | undefined) => SETUP_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? "";
export const closeReasonLabel = (value: string | null | undefined) => CLOSE_REASON_OPTIONS.find((option) => option.value === value)?.label ?? "";

export function isOpenSetup(update: UpdateLike): boolean {
  const structure = getUpdateStructure(update);
  return structure?.type === "setup" && ["waiting", "running"].includes(structure.setup_status ?? "");
}

export function marketUpdateActivityAt(update: UpdateLike): string {
  return getUpdateStructure(update)?.activity_at ?? update.published_at ?? update.created_at ?? "";
}

export function isPinnedUpdate(update: UpdateLike, now = Date.now()): boolean {
  const structure = getUpdateStructure(update);
  return update.actuality_status !== "archive" && structure?.pinned_rank != null
    && (structure.pin_until === null || Date.parse(structure.pin_until) > now);
}

export function isUrgentUpdate(update: UpdateLike, now = Date.now()): boolean {
  const until = getUpdateStructure(update)?.urgent_until;
  return update.actuality_status !== "archive" && until != null && Date.parse(until) > now;
}

export function needsUpdateFollowUp(update: UpdateLike, now = Date.now()): boolean {
  if (!update.is_published || update.actuality_status === "archive" || !isOpenSetup(update)) return false;
  const fields = getUpdateStructure(update)!.fields;
  return [fields.valid_until, fields.review_at].some((value) => Boolean(value) && Date.parse(value) <= now);
}

export function suggestsUpdateArchive(update: UpdateLike, now = Date.now()): boolean {
  if (!update.is_published || update.actuality_status === "archive" || isOpenSetup(update)) return false;
  if (getUpdateStructure(update)?.type === "education") return false;
  const published = update.published_at ?? update.created_at;
  return published != null && Number.isFinite(Date.parse(published)) && now - Date.parse(published) >= 90 * 24 * 60 * 60 * 1000;
}

export function validateUpdateStructure(
  value: unknown,
  context: { published: boolean; title: string; summary: string | null },
): string | null {
  const error = structureError(value);
  if (error) return error;
  const structure = value as MarketUpdateStructure;
  if (typeof context.title !== "string" || context.title.length > 100) return "Gebruik een titel van maximaal 100 tekens.";
  if (context.summary !== null && (typeof context.summary !== "string" || context.summary.length > 240)) return "Gebruik een kernboodschap van maximaal 240 tekens.";
  if (!context.published) return null;
  if (!context.title.trim()) return "Vul een titel in.";
  if (!context.summary?.trim()) return "Vul een kernboodschap in.";
  const missing = TEMPLATE_FIELDS[structure.type].find((field) => field.required && !structure.fields[field.key]?.trim());
  if (missing) return `Vul het veld ${missing.label.toLowerCase()} in.`;
  if (structure.type === "setup" && structure.targets.length === 0) return "Voeg minimaal één doel toe.";
  return null;
}
