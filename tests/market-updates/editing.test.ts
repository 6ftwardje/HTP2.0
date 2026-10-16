import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMarketUpdateWorkflow,
  duplicateMarketUpdateStructure,
  prepareMarketUpdateEdit,
  structureSnapshot,
  type WorkflowCommand,
} from "../../lib/market-update-editing";
import { emptyStructure, type MarketUpdateStructure } from "../../lib/market-update-structure";
import type { WeeklyUpdate } from "../../lib/types";

const publication = "2026-10-15T10:00:00Z";
const changed = "2026-10-15T11:00:00Z";
const now = "2026-10-16T12:00:00Z";
const author = "Arno";

function setup(): MarketUpdateStructure {
  const value = emptyStructure("setup");
  value.category = "crypto";
  value.fields = {
    ...value.fields, instrument: "BTC/USD", direction: "long", timeframe: "4 uur",
    entry: "60.000–61.000", entry_condition: "Bevestiging binnen de zone.",
    invalidation: "Sluiting onder de zone.", rationale: "Steun is eerder bevestigd.",
  };
  value.targets = [{ label: "64.000", reached_at: null }, { label: "66.000", reached_at: null }];
  value.activity_at = publication;
  value.history = [{ id: "published-original", at: publication, author, kind: "published", note: "Update gepubliceerd." }];
  return value;
}

function update(structure = setup(), overrides: Partial<WeeklyUpdate> = {}): WeeklyUpdate {
  return {
    id: 42, type: "market_update", title: "BTC: bevestiging afwachten",
    summary: "De steunzone bepaalt het scenario.", is_published: true,
    actuality_status: "current", update_structure: structure,
    published_at: publication, created_at: publication, updated_at: changed,
    ...overrides,
  } as WeeklyUpdate;
}

const workflow = (value: WeeklyUpdate, command: Omit<WorkflowCommand, "expectedUpdatedAt">) =>
  applyMarketUpdateWorkflow(value, { expectedUpdatedAt: value.updated_at, ...command }, author, now);

function edit(value: WeeklyUpdate, submitted: MarketUpdateStructure, note = "") {
  return prepareMarketUpdateEdit({
    submitted, current: value, title: value.title, summary: value.summary,
    publish: true, note, author, now,
  });
}

test("browser-submitted history, lifecycle and activity cannot overwrite server-owned progression", () => {
  const stored = setup();
  stored.setup_status = "running";
  stored.targets[0].reached_at = changed;
  const submitted = structuredClone(stored);
  submitted.setup_status = "closed";
  submitted.close_reason = "targets";
  submitted.closed_at = now;
  submitted.activity_at = now;
  submitted.targets[0].reached_at = null;
  submitted.targets[1].reached_at = now;
  submitted.history = [{ id: "forged", at: now, author: "Fake", kind: "closed", note: "Forged" }];
  const result = edit(update(stored), submitted);
  assert.ok(result.structure, result.error);
  assert.equal(result.structure.setup_status, "running");
  assert.equal(result.structure.close_reason, null);
  assert.equal(result.structure.closed_at, null);
  assert.equal(result.structure.activity_at, publication);
  assert.deepEqual(result.structure.targets.map((target) => target.reached_at), [changed, null]);
  assert.deepEqual(result.structure.history, stored.history);
  assert.notEqual(result.structure.history, stored.history);
});

test("critical changes on a published setup require a note and preserve original levels in history", () => {
  for (const field of ["timeframe", "entry", "entry_condition", "invalidation", "stop"]) {
    const stored = setup();
    const submitted = structuredClone(stored);
    submitted.fields[field] = `Nieuw ${field}`;
    assert.ok(edit(update(stored), submitted).error, field);
    const result = edit(update(stored), submitted, "Nieuwe bevestiging op de grafiek.");
    assert.ok(result.structure, result.error);
    assert.equal(result.structure.fields[field], `Nieuw ${field}`);
    assert.equal(result.structure.history.at(-1)?.snapshot?.fields[field], stored.fields[field]);
    assert.equal(result.structure.history.at(-1)?.kind, "follow_up");
    assert.equal(result.structure.activity_at, now);
    assert.deepEqual(stored, setup(), "input remains unchanged");
  }
  const stored = setup();
  const submitted = structuredClone(stored);
  submitted.targets[1].label = "67.000";
  assert.ok(edit(update(stored), submitted).error);
  const result = edit(update(stored), submitted, "Tweede doel aangepast aan de weerstand.");
  assert.equal(result.structure?.history.at(-1)?.snapshot?.targets[1].label, "66.000");
});

test("an editorial typo correction preserves chronology and does not add a follow-up", () => {
  const stored = setup();
  const value = update(stored);
  const result = prepareMarketUpdateEdit({
    submitted: structuredClone(stored), current: value,
    title: "BTC: bevestiging afwachten.", summary: value.summary,
    publish: true, author, now,
  });
  assert.ok(result.structure, result.error);
  assert.equal(result.structure.activity_at, publication);
  assert.deepEqual(result.structure.history, stored.history);
});

test("central analysis changes and setup rationale require a note with the original content preserved", () => {
  const analysis = emptyStructure("analysis");
  analysis.fields = { ...analysis.fields, instrument: "Crypto", timeframe: "Deze week", rationale: "Oorspronkelijke analyse.", invalidation: "Verlies van steun." };
  analysis.history = [{ id: "analysis-publication", at: publication, author, kind: "published", note: "Update gepubliceerd." }];
  for (const key of ["rationale", "invalidation"]) {
    const submitted = structuredClone(analysis);
    submitted.fields[key] = "Nieuwe centrale analyse.";
    assert.ok(edit(update(analysis), submitted).error);
    const result = edit(update(analysis), submitted, "De marktomstandigheden zijn veranderd.");
    assert.equal(result.structure?.history.at(-1)?.snapshot?.fields[key], analysis.fields[key]);
  }
  const stored = setup();
  const submitted = structuredClone(stored);
  submitted.fields.rationale = "Een andere onderbouwing.";
  assert.ok(edit(update(stored), submitted).error);
  assert.equal(edit(update(stored), submitted, "Nieuwe bevestiging.").structure?.history.at(-1)?.snapshot?.fields.rationale, stored.fields.rationale);
  const previous = update(analysis, { body: "Oorspronkelijke leesbare inhoud." });
  const changedSummary = { submitted: analysis, current: previous, title: previous.title, summary: "Een gewijzigde conclusie.", publish: true, author, now };
  assert.ok(prepareMarketUpdateEdit(changedSummary).error);
  const result = prepareMarketUpdateEdit({ ...changedSummary, note: "De conclusie volgt uit de nieuwe analyse." });
  assert.equal(result.structure?.history.at(-1)?.snapshot?.title, previous.title);
  assert.equal(result.structure?.history.at(-1)?.snapshot?.summary, previous.summary);
  assert.equal(result.structure?.history.at(-1)?.snapshot?.body, previous.body);
});

test("a published setup cannot silently change instrument, direction, type or a reached goal", () => {
  const stored = setup();
  stored.setup_status = "running";
  stored.targets[0].reached_at = changed;
  for (const field of ["instrument", "direction"]) {
    const submitted = structuredClone(stored);
    submitted.fields[field] = field === "direction" ? "short" : "ETH/USD";
    assert.ok(edit(update(stored), submitted, "Aanpassing.").error, field);
  }
  const submitted = structuredClone(stored);
  submitted.targets[0].label = "65.000";
  assert.ok(edit(update(stored), submitted, "Doel gewijzigd.").error);
  assert.ok(edit(update(stored), emptyStructure("analysis"), "Type gewijzigd.").error);
});

test("entry is allowed only while waiting and captures the original status", () => {
  const stored = setup();
  const entered = workflow(update(stored), { action: "entry" });
  assert.equal(entered.structure?.setup_status, "running");
  assert.equal(entered.structure?.history.at(-1)?.snapshot?.setup_status, "waiting");
  assert.equal(entered.structure?.history.at(-1)?.kind, "entry");
  assert.equal(stored.setup_status, "waiting");
  assert.ok(workflow(update(entered.structure!), { action: "entry" }).error);
  const closed = { ...stored, setup_status: "closed" as const, close_reason: "cancelled" as const, closed_at: now };
  assert.ok(workflow(update(closed), { action: "entry" }).error);
});

test("targets may be reached only while running, once, and at a valid index", () => {
  const stored = setup();
  assert.ok(workflow(update(stored), { action: "target", targetIndex: 0 }).error);
  stored.setup_status = "running";
  for (const index of [-1, 0.5, 2, Number.NaN]) assert.ok(workflow(update(stored), { action: "target", targetIndex: index }).error);
  const reached = workflow(update(stored), { action: "target", targetIndex: 0 });
  assert.equal(reached.structure?.targets[0].reached_at, now);
  assert.equal(reached.structure?.targets[1].reached_at, null);
  assert.equal(reached.structure?.setup_status, "running");
  assert.equal(reached.structure?.history.at(-1)?.snapshot?.targets[0].reached_at, null);
  assert.ok(workflow(update(reached.structure!), { action: "target", targetIndex: 0 }).error);
});

test("closure reasons follow the entry state and goals closure requires all planned goals", () => {
  for (const reason of ["targets", "stopped", "manual"] as const) {
    assert.ok(workflow(update(), { action: "close", reason, note: "Afgesloten." }).error, reason);
  }
  for (const reason of ["cancelled", "expired"] as const) {
    const result = workflow(update(), { action: "close", reason, note: "Geen entry binnen het scenario." });
    assert.equal(result.structure?.setup_status, "closed");
    assert.equal(result.structure?.close_reason, reason);
    assert.equal(result.structure?.closed_at, now);
  }
  const running = setup();
  running.setup_status = "running";
  for (const reason of ["cancelled", "expired"] as const) assert.ok(workflow(update(running), { action: "close", reason, note: "Afgesloten." }).error);
  assert.ok(workflow(update(running), { action: "close", reason: "manual" }).error);
  assert.ok(workflow(update(running), { action: "close", reason: "targets", note: "Doelen bereikt." }).error);
  running.targets[0].reached_at = changed;
  assert.ok(workflow(update(running), { action: "close", reason: "targets", note: "Doelen bereikt." }).error);
  running.targets[1].reached_at = now;
  const finished = workflow(update(running), { action: "close", reason: "targets", note: "Alle doelen bereikt." });
  assert.equal(finished.structure?.close_reason, "targets");
  assert.ok(workflow(update(finished.structure!), { action: "close", reason: "manual", note: "Nogmaals." }).error);
});

test("a stopped setup retains a partially reached goal and its original timestamp", () => {
  const stored = setup();
  stored.setup_status = "running";
  stored.targets[0].reached_at = changed;
  const result = workflow(update(stored), { action: "close", reason: "stopped", note: "Na doel 1 is de invalidatie bereikt." });
  assert.equal(result.structure?.setup_status, "closed");
  assert.equal(result.structure?.close_reason, "stopped");
  assert.deepEqual(result.structure?.targets.map((target) => target.reached_at), [changed, null]);
  assert.deepEqual(result.structure?.history.at(-1)?.snapshot?.targets, stored.targets);
});

test("corrections require explanation; resetting to waiting clears reached goals and closure", () => {
  const stored = setup();
  stored.setup_status = "closed";
  stored.close_reason = "stopped";
  stored.closed_at = changed;
  stored.targets[0].reached_at = changed;
  assert.ok(workflow(update(stored), { action: "correct", status: "waiting" }).error);
  const result = workflow(update(stored), { action: "correct", status: "waiting", note: "De entry was onjuist geregistreerd." });
  assert.equal(result.structure?.setup_status, "waiting");
  assert.equal(result.structure?.close_reason, null);
  assert.equal(result.structure?.closed_at, null);
  assert.deepEqual(result.structure?.targets.map((target) => target.reached_at), [null, null]);
  assert.equal(result.structure?.history.at(-1)?.kind, "correction");
  assert.equal(result.structure?.history.at(-1)?.snapshot?.close_reason, "stopped");
  assert.equal(stored.targets[0].reached_at, changed);
  assert.ok(workflow(update(stored), { action: "correct", note: "Zonder wijziging." }).error);
});

test("stale writes, archived updates and unpublished drafts cannot receive follow-ups", () => {
  const value = update();
  const command: WorkflowCommand = { action: "follow_up", expectedUpdatedAt: publication, note: "Nieuwe observatie." };
  assert.match(applyMarketUpdateWorkflow(value, command, author, now).error!, /intussen gewijzigd/);
  assert.ok(workflow(update(setup(), { actuality_status: "archive" }), { action: "follow_up", note: "Nieuwe observatie." }).error);
  assert.ok(workflow(update(setup(), { is_published: false }), { action: "follow_up", note: "Nieuwe observatie." }).error);
  assert.ok(workflow(value, { action: "follow_up", note: " " }).error);
  const followed = workflow(value, { action: "follow_up", note: "Nieuwe observatie." });
  assert.equal(followed.structure?.history.at(-1)?.kind, "follow_up");
  assert.equal(followed.structure?.activity_at, now);
});

test("duplication copies content while resetting lifecycle, schedule, history, pins and urgency without aliases", () => {
  const stored = setup();
  stored.setup_status = "closed";
  stored.close_reason = "stopped";
  stored.closed_at = changed;
  stored.targets[0].reached_at = changed;
  stored.fields.valid_until = "2026-10-18T12:00:00Z";
  stored.fields.review_at = "2026-10-17T12:00:00Z";
  stored.pinned_rank = 1;
  stored.pin_until = "2026-10-17T12:00:00Z";
  stored.urgent_until = "2026-10-17T12:00:00Z";
  const original = structuredClone(stored);
  const duplicate = duplicateMarketUpdateStructure(stored);
  assert.equal(duplicate.category, stored.category);
  assert.equal(duplicate.fields.instrument, stored.fields.instrument);
  assert.equal(duplicate.fields.rationale, stored.fields.rationale);
  assert.deepEqual(duplicate.targets.map((target) => target.label), stored.targets.map((target) => target.label));
  assert.deepEqual(duplicate.targets.map((target) => target.reached_at), [null, null]);
  assert.equal(duplicate.setup_status, "waiting");
  assert.equal(duplicate.close_reason, null);
  assert.equal(duplicate.closed_at, null);
  assert.equal(duplicate.activity_at, null);
  assert.equal(duplicate.fields.valid_until, "");
  assert.equal(duplicate.fields.review_at, "");
  assert.equal(duplicate.pinned_rank, null);
  assert.equal(duplicate.pin_until, null);
  assert.equal(duplicate.urgent_until, null);
  assert.deepEqual(duplicate.history, []);
  duplicate.targets[0].label = "Gewijzigd";
  duplicate.fields.instrument = "ETH/USD";
  assert.deepEqual(stored, original);
  const snapshot = structureSnapshot(stored);
  snapshot.fields.instrument = "SOL/USD";
  snapshot.targets[0].label = "Ander doel";
  assert.deepEqual(stored, original);
});
