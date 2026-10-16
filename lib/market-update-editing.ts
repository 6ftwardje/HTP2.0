import {
  getUpdateStructure,
  validateUpdateStructure,
  TEMPLATE_FIELDS,
  type MarketUpdateStructure,
  type SetupCloseReason,
  type SetupStatus,
  type UpdateHistoryEntry,
} from "@/lib/market-update-structure";
import type { WeeklyUpdate } from "@/lib/types";

export type WorkflowCommand = {
  action: "entry" | "target" | "close" | "follow_up" | "correct";
  expectedUpdatedAt: string;
  targetIndex?: number;
  reason?: SetupCloseReason;
  status?: SetupStatus;
  targetReached?: boolean;
  note?: string;
};

type Result = { structure: MarketUpdateStructure; error?: never } | { error: string; structure?: never };

/** Plain-text compatibility projection; the rubric renders the fields themselves. */
export function structureFallbackBody(structure: MarketUpdateStructure, summary: string | null): string {
  return [summary, ...TEMPLATE_FIELDS[structure.type].flatMap((field) => structure.fields[field.key]?.trim() ? [`${field.label}: ${structure.fields[field.key].trim()}`] : [])]
    .filter(Boolean).join("\n\n").slice(0, 12000);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function structureSnapshot(structure: MarketUpdateStructure, core?: Pick<WeeklyUpdate, "title" | "summary" | "body"> | null) {
  return clone({ fields: structure.fields, targets: structure.targets, setup_status: structure.setup_status, close_reason: structure.close_reason, ...(core ? { title: core.title, summary: core.summary, body: core.body } : {}) });
}

function appendHistory(structure: MarketUpdateStructure, before: MarketUpdateStructure, kind: UpdateHistoryEntry["kind"], note: string, author: string, now: string, core?: Pick<WeeklyUpdate, "title" | "summary" | "body"> | null) {
  structure.history.push({ id: crypto.randomUUID(), at: now, author, kind, note, snapshot: structureSnapshot(before, core) });
  structure.activity_at = now;
}

/** Only editorial fields come from the browser; history and progression are server owned. */
export function prepareMarketUpdateEdit({ submitted, current, title, summary, publish, note = "", author, now = new Date().toISOString() }: {
  submitted: MarketUpdateStructure;
  current?: WeeklyUpdate | null;
  title: string;
  summary: string | null;
  publish: boolean;
  note?: string;
  author: string;
  now?: string;
}): Result {
  const before = current ? getUpdateStructure(current) : null;
  const next = clone(submitted);
  const previouslyPublished = Boolean(current?.is_published || before?.history.some((event) => event.kind === "published"));
  if (previouslyPublished && before && before.type !== next.type) return { error: "Het type van een gepubliceerde update blijft behouden. Dupliceer voor een nieuw scenario." };
  next.history = clone(before?.history ?? []);
  next.activity_at = before?.activity_at ?? null;
  next.closed_at = before?.closed_at ?? null;
  next.setup_status = next.type === "setup" ? (before?.type === "setup" ? before.setup_status : "waiting") : null;
  next.close_reason = next.type === "setup" && before?.type === "setup" ? before.close_reason : null;
  next.targets = next.type === "setup" ? next.targets.map((target, index) => ({ label: target.label.trim(), reached_at: before?.type === "setup" ? before.targets[index]?.reached_at ?? null : null })) : [];
  const cleanNote = note.trim();
  if (cleanNote.length > 2000) return { error: "Houd de wijzigingsnotitie binnen 2.000 tekens." };
  if (before?.type === "setup" && previouslyPublished) {
    if (before.fields.instrument !== next.fields.instrument || before.fields.direction !== next.fields.direction) return { error: "Gebruik een nieuwe setup voor een ander instrument of een andere richting." };
    if (before.targets.some((target, index) => target.reached_at && target.label !== next.targets[index]?.label)) return { error: "Een bereikt doel blijft behouden. Corrigeer eerst de voortgang als de markering onjuist is." };
    const critical = ["timeframe", "entry", "entry_condition", "invalidation", "stop", "rationale"];
    const levelsChanged = critical.some((key) => before.fields[key] !== next.fields[key]) || JSON.stringify(before.targets.map((t) => t.label)) !== JSON.stringify(next.targets.map((t) => t.label));
    if ((levelsChanged || current?.summary !== summary) && !cleanNote) return { error: "Leg wijzigingen aan de kernboodschap, onderbouwing, timeframe, entry, invalidatie of doelen kort uit in de wijzigingsnotitie." };
  }
  if (before?.type === "analysis" && previouslyPublished && !cleanNote && (["rationale", "invalidation"].some((key) => before.fields[key] !== next.fields[key]) || current?.summary !== summary)) return { error: "Licht de gewijzigde kernboodschap of centrale analyse toe in de wijzigingsnotitie." };
  if (!before && current?.is_published) {
    next.history.push({ id: crypto.randomUUID(), at: current.published_at ?? current.created_at, author, kind: "published", note: "Oorspronkelijke publicatiedatum vastgelegd bij het indelen." });
    next.history.push({ id: crypto.randomUUID(), at: now, author, kind: "correction", note: "Structuur toegevoegd aan deze bestaande update.", snapshot: structureSnapshot(next, current) });
    next.activity_at = current.published_at ?? current.created_at;
  }
  if (before && previouslyPublished && cleanNote) appendHistory(next, before, "follow_up", cleanNote, author, now, current);
  if (publish && !current?.is_published && !next.history.some((event) => event.kind === "published")) {
    next.history.push({ id: crypto.randomUUID(), at: now, author, kind: "published", note: "Update gepubliceerd.", snapshot: structureSnapshot(next) });
    next.activity_at = now;
  }
  if (current?.actuality_status === "archive") {
    next.pinned_rank = null;
    next.pin_until = null;
    next.urgent_until = null;
  }
  const error = validateUpdateStructure(next, { published: publish, title, summary });
  return error ? { error } : { structure: next };
}

export function originalMarketUpdatePublication(update: WeeklyUpdate): string | null {
  return getUpdateStructure(update)?.history.find((entry) => entry.kind === "published")?.at ?? update.published_at;
}

export function applyMarketUpdateWorkflow(update: WeeklyUpdate, command: WorkflowCommand, author: string, now = new Date().toISOString()): Result {
  if (!command || typeof command !== "object" || !["entry", "target", "close", "follow_up", "correct"].includes(command.action)
    || typeof command.expectedUpdatedAt !== "string"
    || (command.note !== undefined && typeof command.note !== "string")
    || (command.status !== undefined && !["waiting", "running", "closed"].includes(command.status))
    || (command.reason !== undefined && !["targets", "stopped", "cancelled", "expired", "manual"].includes(command.reason))
    || (command.targetReached !== undefined && typeof command.targetReached !== "boolean")
    || (command.targetIndex !== undefined && !Number.isSafeInteger(command.targetIndex))) return { error: "De opvolgactie is ongeldig. Vernieuw het formulier." };
  const before = getUpdateStructure(update);
  if (!before || update.type !== "market_update") return { error: "Deel deze update eerst in met een inhoudstype en categorie." };
  if (!update.is_published || update.actuality_status === "archive") return { error: "Opvolgen kan bij een gepubliceerde, actuele update." };
  if (command.expectedUpdatedAt !== update.updated_at) return { error: "De update is intussen gewijzigd. Vernieuw de pagina voordat je verdergaat." };
  const next = clone(before);
  const note = command.note?.trim() ?? "";
  if (note.length > 2000) return { error: "Houd de toelichting binnen 2.000 tekens." };
  let kind: UpdateHistoryEntry["kind"];
  let message = note;
  if (command.action === "follow_up") {
    if (!note) return { error: "Schrijf een korte opvolging." };
    kind = "follow_up";
  } else {
    if (before.type !== "setup") return { error: "Deze actie is alleen beschikbaar voor setups." };
    if (command.action === "entry") {
      if (before.setup_status !== "waiting") return { error: "Alleen een setup die op de entry wacht kan gaan lopen." };
      next.setup_status = "running";
      kind = "entry";
      message = note || "Entryvoorwaarde bereikt; het scenario loopt.";
    } else if (command.action === "target") {
      if (before.setup_status !== "running") return { error: "Markeer doelen alleen bij een lopende setup." };
      const index = command.targetIndex;
      if (!Number.isInteger(index) || index === undefined || index < 0 || !next.targets[index]) return { error: "Kies een geldig doel." };
      if (next.targets[index].reached_at) return { error: "Dit doel is al als bereikt gemarkeerd." };
      next.targets[index].reached_at = now;
      kind = "target";
      message = note || `Doel ${index + 1} bereikt: ${next.targets[index].label}.`;
    } else if (command.action === "close") {
      if (before.setup_status === "closed") return { error: "Deze setup is al afgesloten." };
      const reason = command.reason;
      const allowed = before.setup_status === "waiting" ? ["cancelled", "expired"] : ["targets", "stopped", "manual"];
      if (!reason || !allowed.includes(reason)) return { error: "Kies een afsluitreden die bij de huidige setupstatus past." };
      if (reason === "targets" && (!next.targets.length || next.targets.some((target) => !target.reached_at))) return { error: "Markeer eerst alle geplande doelen als bereikt." };
      if (!note) return { error: "Licht kort toe waarom je de setup afsluit." };
      next.setup_status = "closed";
      next.close_reason = reason;
      next.closed_at = now;
      kind = "closed";
    } else if (command.action === "correct") {
      if (!note) return { error: "Een correctie vereist een korte toelichting." };
      if (command.status !== undefined) {
        if (!["waiting", "running", "closed"].includes(command.status)) return { error: "Kies een geldige status." };
        next.setup_status = command.status;
        next.close_reason = command.status === "closed" ? command.reason ?? null : null;
        next.closed_at = command.status === "closed" ? now : null;
        if (command.status === "waiting") next.targets.forEach((target) => { target.reached_at = null; });
      }
      if (command.targetIndex !== undefined) {
        const index = command.targetIndex;
        if (!Number.isInteger(index) || index < 0 || !next.targets[index] || typeof command.targetReached !== "boolean") return { error: "Kies het doel en de juiste voortgang voor de correctie." };
        next.targets[index].reached_at = command.targetReached ? now : null;
      }
      if (command.status === undefined && command.targetIndex === undefined) return { error: "Kies wat je wilt corrigeren." };
      kind = "correction";
    } else return { error: "Onbekende opvolgactie." };
  }
  appendHistory(next, before, kind, message, author, now, update);
  const error = validateUpdateStructure(next, { published: true, title: update.title, summary: update.summary });
  return error ? { error } : { structure: next };
}

export function duplicateMarketUpdateStructure(structure: MarketUpdateStructure): MarketUpdateStructure {
  return {
    ...clone(structure),
    targets: structure.targets.map((target) => ({ label: target.label, reached_at: null })),
    setup_status: structure.type === "setup" ? "waiting" : null,
    close_reason: null, closed_at: null, history: [], activity_at: null,
    pinned_rank: null, pin_until: null, urgent_until: null,
    fields: { ...structure.fields, ...("valid_until" in structure.fields ? { valid_until: "" } : {}), ...("review_at" in structure.fields ? { review_at: "" } : {}) },
  };
}
