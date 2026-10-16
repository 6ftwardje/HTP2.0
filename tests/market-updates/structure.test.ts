import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyStructure, getUpdateCategory, getUpdateStructure, isOpenSetup, isPinnedUpdate,
  isUrgentUpdate, marketUpdateActivityAt, needsUpdateFollowUp, suggestsUpdateArchive,
  TEMPLATE_FIELDS, validateUpdateStructure, type MarketUpdateStructure,
} from "../../lib/market-update-structure";

const now = Date.parse("2026-10-16T12:00:00Z");
const context = { published: true, title: "BTC: wachten op bevestiging", summary: "Een scenario met expliciete voorwaarden." };
function setup(): MarketUpdateStructure {
  const value = emptyStructure("setup");
  value.category = "crypto";
  value.fields = {
    ...value.fields, instrument: "BTC/USD", direction: "long", timeframe: "4 uur",
    entry: "60.000–61.000", entry_condition: "Een bevestigde sluiting in de zone.",
    invalidation: "Sluiting onder de zone.", rationale: "De zone is eerder als steun bevestigd.",
  };
  value.targets = [{ label: "64.000", reached_at: null }, { label: "66.000", reached_at: null }];
  return value;
}

test("concepts may be incomplete; publication requires the matching template, title and summary", () => {
  for (const type of ["setup", "analysis", "news", "education"] as const) {
    const structure = emptyStructure(type);
    assert.equal(validateUpdateStructure(structure, { ...context, published: false }), null);
    assert.ok(validateUpdateStructure(structure, context));
    for (const field of TEMPLATE_FIELDS[type]) if (field.required) structure.fields[field.key] = field.key === "source_url" ? "https://example.org/source" : field.key === "direction" ? "long" : "Inhoud";
    if (type === "setup") structure.targets = [{ label: "Doel 1", reached_at: null }];
    assert.equal(validateUpdateStructure(structure, context), null);
  }
  assert.match(validateUpdateStructure(setup(), { ...context, title: "x".repeat(101) })!, /100/);
  assert.match(validateUpdateStructure(setup(), { ...context, summary: "x".repeat(241) })!, /240/);
  assert.ok(validateUpdateStructure(setup(), { ...context, summary: " " }));
});

test("runtime guards safely reject malformed metadata and unsupported future versions", () => {
  for (const malformed of [null, [], "setup", 12, {}, { version: 2 }, { ...setup(), extra: true },
    { ...setup(), category: "Trading" }, { ...setup(), fields: { ...setup().fields, unexpected: "x" } },
    { ...setup(), history: [null] }, { ...setup(), targets: [null] },
    { ...setup(), history: [{ id: "a", at: "2026-10-16T12:00:00Z", author: "Arno", kind: "published", note: "", snapshot: { fields: null } }] },
  ]) {
    assert.doesNotThrow(() => getUpdateStructure({ update_structure: malformed }));
    assert.equal(getUpdateStructure({ update_structure: malformed }), null);
  }
  assert.equal(getUpdateStructure({ update_structure: setup() })?.type, "setup");
});

test("history supports bounded original title, summary and body without accepting malformed values", () => {
  const value = setup();
  const snapshot = { fields: { ...value.fields }, targets: [...value.targets], setup_status: value.setup_status, close_reason: value.close_reason, title: "Oorspronkelijke titel", summary: "Oorspronkelijke kernboodschap.", body: "Oorspronkelijke inhoud." };
  value.history = [{ id: "original", at: "2026-10-16T12:00:00Z", author: "Arno", kind: "follow_up", note: "Gewijzigde conclusie.", snapshot }];
  assert.ok(getUpdateStructure({ update_structure: value }));
  for (const malformed of [{ ...snapshot, summary: {} }, { ...snapshot, title: "x".repeat(1001) }, { ...snapshot, body: "x".repeat(12001) }, { ...snapshot, unsupported: true }]) {
    assert.equal(getUpdateStructure({ update_structure: { ...value, history: [{ ...value.history[0], snapshot: malformed }] } }), null);
  }
});

test("setup progress retains reached targets and requires a valid closure", () => {
  const value = setup();
  value.targets[0].reached_at = "2026-10-16T12:00:00Z";
  assert.ok(validateUpdateStructure(value, context), "waiting setup cannot have reached goals");
  value.setup_status = "running";
  assert.equal(validateUpdateStructure(value, context), null);
  assert.equal(isOpenSetup({ update_structure: value }), true);
  value.setup_status = "closed";
  assert.ok(validateUpdateStructure(value, context), "closure reason and time required");
  value.closed_at = "2026-10-16T13:00:00Z";
  value.close_reason = "targets";
  assert.ok(validateUpdateStructure(value, context), "every goal must have been reached");
  value.close_reason = "stopped";
  assert.equal(validateUpdateStructure(value, context), null);
  assert.equal(value.targets[0].reached_at, "2026-10-16T12:00:00Z");
  assert.equal(isOpenSetup({ update_structure: value }), false);
});

test("publication validates dates, source schemes, field bounds and at most three targets", () => {
  const value = setup();
  value.fields.valid_until = "2026-02-31T12:00";
  assert.ok(validateUpdateStructure(value, context));
  value.fields.valid_until = "2026-10-17T12:00";
  assert.equal(validateUpdateStructure(value, context), null);
  value.targets = Array.from({ length: 4 }, (_, index) => ({ label: `Doel ${index + 1}`, reached_at: null }));
  assert.ok(validateUpdateStructure(value, context));
  value.targets = [];
  assert.ok(validateUpdateStructure(value, context));
  value.targets = [{ label: "Doel", reached_at: null }];
  value.fields.instrument = "x".repeat(121);
  assert.ok(validateUpdateStructure(value, context));
  const news = emptyStructure("news");
  for (const field of TEMPLATE_FIELDS.news) if (field.required) news.fields[field.key] = "Inhoud";
  for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://example.org", "not a URL", "https://name:secret@example.org"]) {
    news.fields.source_url = url;
    assert.ok(validateUpdateStructure(news, context));
  }
  news.fields.source_url = "https://example.org/news";
  assert.equal(validateUpdateStructure(news, context), null);
});

test("legacy categorisation is conservative and structure takes precedence", () => {
  assert.equal(getUpdateCategory({ market: "crypto" }), "crypto");
  assert.equal(getUpdateCategory({ markets: ["forex"] }), "forex");
  assert.equal(getUpdateCategory({ markets: ["forex", "forex"] }), "forex");
  assert.equal(getUpdateCategory({ markets: ["crypto", "forex"] }), "general");
  assert.equal(getUpdateCategory({ markets: ["macro"] }), "general");
  assert.equal(getUpdateCategory({ market: null }), null);
  assert.equal(getUpdateCategory({ market: "unknown" }), null);
  assert.equal(getUpdateCategory({ market: "forex", update_structure: setup() }), "crypto");
});

test("pin and urgent labels expire and archives suppress them without changing data", () => {
  const value = setup();
  value.pinned_rank = 1;
  value.pin_until = "2026-10-16T12:01:00Z";
  value.urgent_until = value.pin_until;
  assert.equal(isPinnedUpdate({ update_structure: value }, now), true);
  assert.equal(isUrgentUpdate({ update_structure: value }, now), true);
  assert.equal(isPinnedUpdate({ update_structure: value }, now + 60_000), false);
  assert.equal(isUrgentUpdate({ update_structure: value }, now + 60_000), false);
  assert.equal(isPinnedUpdate({ update_structure: value, actuality_status: "archive" }, now), false);
  assert.equal(isUrgentUpdate({ update_structure: value, actuality_status: "archive" }, now), false);
  assert.equal(value.pinned_rank, 1);
});

test("only open published setups with due dates need follow-up", () => {
  const value = setup();
  value.fields.review_at = "2026-10-16T11:59:00Z";
  const update = { update_structure: value, is_published: true };
  assert.equal(needsUpdateFollowUp(update, now), true);
  assert.equal(needsUpdateFollowUp({ ...update, is_published: false }, now), false);
  assert.equal(needsUpdateFollowUp({ ...update, actuality_status: "archive" }, now), false);
  value.fields.review_at = "2026-10-16T12:01:00Z";
  assert.equal(needsUpdateFollowUp(update, now), false);
});

test("archive suggestions exclude education, open setups, drafts and existing archives", () => {
  const base = { is_published: true, published_at: "2026-07-01T12:00:00Z" };
  assert.equal(suggestsUpdateArchive(base, now), true);
  assert.equal(suggestsUpdateArchive({ ...base, update_structure: setup() }, now), false);
  assert.equal(suggestsUpdateArchive({ ...base, update_structure: emptyStructure("education") }, now), false);
  assert.equal(suggestsUpdateArchive({ ...base, is_published: false }, now), false);
  assert.equal(suggestsUpdateArchive({ ...base, actuality_status: "archive" }, now), false);
  assert.equal(suggestsUpdateArchive({ ...base, published_at: "2026-10-01T12:00:00Z" }, now), false);
});

test("minor edits do not affect chronology; explicit activity does", () => {
  const base = { published_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-16T12:00:00Z" };
  assert.equal(marketUpdateActivityAt(base), base.published_at);
  const value = setup();
  value.activity_at = "2026-10-15T12:00:00Z";
  assert.equal(marketUpdateActivityAt({ ...base, update_structure: value }), value.activity_at);
});
