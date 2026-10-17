import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as marketEditorial from "../../lib/market-editorial";
import * as marketArticle from "../../lib/market-article";
import * as marketAuthor from "../../lib/market-update-author";
import * as marketPolicy from "../../lib/market-update-policy";
import * as marketChapters from "../../lib/market-chapters";
import * as marketStructure from "../../lib/market-update-structure";
import * as marketEditing from "../../lib/market-update-editing";
import * as marketAnalysis from "../../lib/market-analysis";
import { SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS } from "../../lib/weekly-update-access";
import type { WeeklyUpdate } from "../../lib/types";

const stamp = "2026-10-15T10:00:00Z";
const actor = { id: "synthetic-admin", name: "Arno", email: "arno@example.test" };
const copy = <T,>(value: T): T => structuredClone(value);

function structure(type: marketStructure.UpdateType = "setup") {
  const value = marketStructure.emptyStructure(type);
  for (const field of marketStructure.TEMPLATE_FIELDS[type]) {
    if (field.required) value.fields[field.key] = field.key === "source_url" ? "https://example.test/source" : field.key === "direction" ? "long" : `Duidelijke inhoud voor ${field.label.toLowerCase()}.`;
  }
  if (type === "setup") {
    value.fields.instrument = "BTC/USD";
    value.targets = [{ label: "Doel 1", reached_at: null }, { label: "Doel 2", reached_at: null }];
  }
  return value;
}

function row(overrides: Partial<WeeklyUpdate> = {}): WeeklyUpdate {
  return {
    id: 42, title: "BTC: bevestiging afwachten", slug: "btc-bevestiging-afwachten",
    summary: "De steunzone bepaalt het scenario.", type: "market_update", market: "crypto", markets: ["crypto"],
    content_format: "text", content_kind: "video", body: "Voldoende inhoud voor de bestaande publicatiecontrole.",
    image_paths: [], article_html: null, intro: null, key_takeaways: [], week_start_date: "2026-10-12",
    mentor_student_id: actor.id, created_by_student_id: actor.id, access_tier: "subscription",
    thumbnail_url: null, video_provider: "mux", video_url: null, video_duration_seconds: null,
    mux_asset_id: null, mux_playback_id: null, mux_playback_policy: "public", mux_status: null,
    mux_upload_id: null, mux_error_message: null, is_published: false, published_at: null,
    created_at: stamp, updated_at: stamp, actuality_status: "current", update_structure: structure(),
    ...overrides,
  };
}

type QueryTrace = { operation: "select" | "insert" | "update"; filters: Array<[string, unknown]>; patch?: Record<string, unknown> };

/** Execute the actual actions and their actual repository adapter with synthetic I/O only. */
function harness(initial: WeeklyUpdate[] = []) {
  const rows = new Map(initial.map((value) => [value.id, copy(value)]));
  const calls = { auth: 0, notifications: [] as number[], audit: [] as unknown[], queries: [] as QueryTrace[], chartCopies: [] as Array<[string, string]> };
  let deny = false;
  let forcedConflict = false;
  let sequence = 100;
  let revision = 0;
  const forbidden = () => { throw new Error("An external provider boundary must not be called by these tests."); };
  const db = {
    from(table: string) {
      assert.equal(table, "weekly_updates");
      const trace: QueryTrace = { operation: "select", filters: [] };
      let executed = false;
      let result: { data: unknown; error: null };
      const execute = () => {
        if (executed) return result;
        executed = true;
        calls.queries.push(copy(trace));
        if (trace.operation === "insert") {
          const inserted = row({ id: ++sequence, ...copy(trace.patch) } as Partial<WeeklyUpdate>);
          rows.set(inserted.id, inserted);
          result = { data: copy(inserted), error: null };
        } else {
          const match = [...rows.values()].find((value) => trace.filters.every(([key, expected]) => (value as unknown as Record<string, unknown>)[key] === expected));
          if (trace.operation === "update" && match && !forcedConflict) {
            Object.assign(match, copy(trace.patch), { updated_at: `2026-10-16T12:00:${String(++revision).padStart(2, "0")}Z` });
          }
          result = { data: match && !(forcedConflict && trace.operation === "update") ? copy(match) : null, error: null };
        }
        return result;
      };
      const query = {
        select: () => query,
        insert: (patch: Record<string, unknown>) => { trace.operation = "insert"; trace.patch = copy(patch); return query; },
        update: (patch: Record<string, unknown>) => { trace.operation = "update"; trace.patch = copy(patch); return query; },
        eq: (key: string, value: unknown) => { trace.filters.push([key, value]); return query; },
        single: async () => execute(),
        maybeSingle: async () => execute(),
        then: (resolveResult: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolveResult),
      };
      return query;
    },
  };
  const dependencies: Record<string, unknown> = {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/admin/access": { requireAdmin: async () => { calls.auth++; if (deny) throw new Error("synthetic forbidden"); return { actorStudent: actor }; } },
    "@/lib/admin/audit": { logAdminAction: async (...args: unknown[]) => { calls.audit.push(args); } },
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/supabase/service": { createServiceClient: () => ({ storage: { from: (bucket: string) => {
      assert.equal(bucket, "market-update-charts");
      return { copy: async (source: string, target: string) => { calls.chartCopies.push([source, target]); return { data: {}, error: null }; } };
    } } }) },
    "@/lib/admin/weekly-update-notifications": { notifyWeeklyUpdatePublished: async ({ weeklyUpdate }: { weeklyUpdate: WeeklyUpdate }) => { calls.notifications.push(weeklyUpdate.id); return { error: null, notified: 1 }; } },
    "@/lib/market-editorial": marketEditorial,
  "@/lib/market-article": marketArticle,
    "@/lib/market-update-author": marketAuthor,
    "@/lib/market-update-policy": marketPolicy,
    "@/lib/market-update-structure": marketStructure,
  "@/lib/market-chapters": marketChapters,
    "@/lib/market-update-editing": marketEditing,
    "@/lib/market-analysis": marketAnalysis,
    "@/lib/weekly-update-access": { SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS },
    "@/lib/mux": { createMuxDirectUpload: forbidden, getMuxAsset: forbidden, getMuxErrorMessage: forbidden, getMuxThumbnailUrl: forbidden, getMuxUpload: forbidden },
    "@/lib/transcription/mux-captions": {},
    "@/lib/transcription/start-policy": {},
    "@/lib/transcription/cost-policy": {},
  };
  const modules = new Map<string, Record<string, (...args: any[]) => any>>();
  function load(path: string) {
    const cached = modules.get(path);
    if (cached) return cached;
    const compiled = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const loaded = { exports: {} as Record<string, (...args: any[]) => any> };
    runInNewContext(compiled.outputText, {
      exports: loaded.exports, module: loaded, console, crypto, FormData, Date,
      process: { env: { NODE_ENV: "development" } },
      require(name: string) {
        if (name === "@/lib/admin/weekly-updates") return load("lib/admin/weekly-updates.ts");
        assert.ok(name in dependencies, `Missing synthetic dependency: ${name}`);
        return dependencies[name];
      },
    });
    modules.set(path, loaded.exports);
    return loaded.exports;
  }
  return {
    rows, calls, deny: () => { deny = true; }, conflict: () => { forcedConflict = true; },
    actions: load("app/actions/admin/weekly-updates.ts"), workflow: load("app/actions/admin/market-update-workflow.ts"),
  };
}

function form(value: WeeklyUpdate, metadata = value.update_structure!) {
  const result = new FormData();
  result.set("title", value.title);
  result.set("slug", value.slug);
  result.set("summary", value.summary ?? "");
  result.set("type", "market_update");
  result.set("content_format", value.content_format);
  result.set("access_tier", value.access_tier);
  result.set("is_published", String(value.is_published));
  result.set("actuality_status", value.actuality_status ?? "current");
  result.set("expected_updated_at", value.updated_at);
  result.set("update_structure", JSON.stringify(metadata));
  return result;
}

test("quick creation maps general and indices without inventing a legacy market and projects readable content", async () => {
  for (const category of ["general", "indices"] as const) {
    const testCase = harness();
    const metadata = structure("analysis");
    metadata.category = category;
    const source = row({ update_structure: metadata });
    const request = form(source);
    request.set("is_published", "true");
    const result = await testCase.actions.adminCreateQuickMarketUpdate(request);
    assert.equal(result.success, true, result.error);
    const created = testCase.rows.get(result.weeklyUpdateId)!;
    assert.equal(created.market, null);
    assert.deepEqual(created.markets, category === "general" ? ["macro"] : ["indices"]);
    assert.equal(created.summary, source.summary);
    assert.match(created.body!, /Onderbouwing:/);
    assert.ok(created.body!.includes(source.summary!));
    assert.equal(created.is_published, false);
    assert.equal(created.published_at, null);
    assert.equal(created.update_structure?.category, category);
    assert.deepEqual(testCase.calls.notifications, []);
  }
});

test("new quick drafts ignore browser-forged history and progress", async () => {
  const testCase = harness();
  const metadata = structure();
  metadata.setup_status = "running";
  metadata.targets[0].reached_at = stamp;
  metadata.activity_at = stamp;
  metadata.history = [{ id: "forged", at: stamp, author: "Impersonated author", kind: "entry", note: "Fake entry." }];
  const result = await testCase.actions.adminCreateQuickMarketUpdate(form(row({ update_structure: metadata })));
  assert.equal(result.success, true, result.error);
  const created = testCase.rows.get(result.weeklyUpdateId)!.update_structure!;
  assert.equal(created.setup_status, "waiting");
  assert.deepEqual(created.targets.map((target) => target.reached_at), [null, null]);
  assert.deepEqual(created.history, []);
  assert.equal(created.activity_at, null);
});

test("quick publication validates template and chart gates, then notifies once on the actual first transition", async () => {
  const missing = row();
  missing.update_structure!.fields.entry_condition = "";
  const invalid = harness([missing]);
  assert.equal((await invalid.actions.adminPublishQuickMarketUpdate(42)).success, false);
  assert.equal(invalid.rows.get(42)?.is_published, false);
  assert.deepEqual(invalid.calls.notifications, []);

  const chart = harness([row({ content_format: "chart" })]);
  assert.match((await chart.actions.adminPublishQuickMarketUpdate(42)).error, /chart/);
  assert.deepEqual(chart.calls.notifications, []);

  const ready = harness([row({ content_format: "chart", image_paths: ["weekly-updates/42/chart.png"] })]);
  assert.equal((await ready.actions.adminPublishQuickMarketUpdate(42)).success, true);
  assert.equal(ready.rows.get(42)?.is_published, true);
  assert.equal(ready.rows.get(42)?.update_structure?.history.filter((event) => event.kind === "published").length, 1);
  assert.deepEqual(ready.calls.notifications, [42]);
  assert.equal((await ready.actions.adminPublishQuickMarketUpdate(42)).success, true);
  assert.deepEqual(ready.calls.notifications, [42]);
  const write = ready.calls.queries.find((query) => query.operation === "update")!;
  assert.deepEqual(write.filters, [["id", 42], ["is_published", false], ["updated_at", stamp]]);
});

test("structured video publication retains the existing Mux readiness gate", async () => {
  const source = row({ content_format: "video", mux_status: "preparing" });
  const testCase = harness([source]);
  const request = form(source);
  request.set("is_published", "true");
  assert.match((await testCase.actions.adminUpdateWeeklyUpdate(42, request)).error, /Mux/);
  assert.equal(testCase.rows.get(42)?.is_published, false);
  assert.deepEqual(testCase.calls.notifications, []);
  testCase.rows.get(42)!.mux_status = "ready";
  testCase.rows.get(42)!.mux_playback_id = "synthetic-playback";
  assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(42, request)).success, true);
  assert.deepEqual(testCase.calls.notifications, [42]);
});

test("complete structured templates permit a short optional note while legacy commentary remains required", async () => {
  const structured = harness([row({ body: "Later meer." })]);
  assert.equal((await structured.actions.adminPublishQuickMarketUpdate(42)).success, true);
  assert.equal(structured.rows.get(42)?.body, "Later meer.");
  const legacy = harness([row({ update_structure: null, body: "Later meer." })]);
  assert.match((await legacy.actions.adminPublishQuickMarketUpdate(42)).error, /20 tekens/);
});

test("admin edits reject stale timestamps and preserve lifecycle and history against forged replacements", async () => {
  const metadata = structure();
  metadata.setup_status = "running";
  metadata.targets[0].reached_at = stamp;
  metadata.history = [{ id: "original", at: stamp, author: "Arno", kind: "published", note: "Original publication." }];
  metadata.activity_at = stamp;
  const source = row({ is_published: true, published_at: stamp, update_structure: metadata });
  const testCase = harness([source]);
  const request = form(source);
  request.set("expected_updated_at", "2026-10-01T00:00:00Z");
  assert.match((await testCase.actions.adminUpdateWeeklyUpdate(42, request)).error, /intussen gewijzigd/);
  assert.equal(testCase.calls.queries.filter((query) => query.operation === "update").length, 0);
  const forged = copy(metadata);
  forged.history = [];
  forged.setup_status = "waiting";
  forged.targets.forEach((target) => { target.reached_at = null; });
  request.set("expected_updated_at", stamp);
  request.set("update_structure", JSON.stringify(forged));
  assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(42, request)).success, true);
  const saved = testCase.rows.get(42)!;
  assert.equal(saved.update_structure?.setup_status, "running");
  assert.equal(saved.update_structure?.targets[0].reached_at, stamp);
  assert.deepEqual(saved.update_structure?.history, metadata.history);
  assert.equal(saved.published_at, stamp);
  assert.deepEqual(testCase.calls.notifications, []);
});

test("structured unpublishing and republishing retain the original publication date", async () => {
  const metadata = structure();
  metadata.history = [{ id: "original-publication", at: stamp, author: "Arno", kind: "published", note: "Update gepubliceerd." }];
  const source = row({ is_published: true, published_at: stamp, update_structure: metadata });
  const testCase = harness([source]);
  const request = form(source);
  request.set("is_published", "false");
  assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(42, request)).success, true);
  assert.equal(testCase.rows.get(42)?.published_at, stamp);
  // Media replacement can clear the row date; metadata still retains the first publication.
  testCase.rows.get(42)!.published_at = null;
  assert.equal((await testCase.actions.adminPublishQuickMarketUpdate(42)).success, true);
  assert.equal(testCase.rows.get(42)?.published_at, stamp);
  assert.equal(testCase.rows.get(42)?.update_structure?.history.filter((event) => event.kind === "published").length, 1);
});

test("archiving refuses open setups; closed archive and restore preserve results and clear labels", async () => {
  const source = row({ is_published: true, published_at: stamp });
  const testCase = harness([source]);
  assert.match((await testCase.workflow.adminArchiveMarketUpdate(42, true, stamp)).error, /Sluit de open setup/);
  assert.equal(testCase.rows.get(42)?.actuality_status, "current");
  const metadata = testCase.rows.get(42)!.update_structure!;
  metadata.setup_status = "closed";
  metadata.close_reason = "stopped";
  metadata.closed_at = stamp;
  metadata.targets[0].reached_at = stamp;
  metadata.pinned_rank = 1;
  metadata.urgent_until = "2099-10-16T12:00:00Z";
  const originalResults = copy(metadata.targets);
  assert.equal((await testCase.workflow.adminArchiveMarketUpdate(42, true, stamp)).success, true);
  const archived = testCase.rows.get(42)!;
  assert.equal(archived.actuality_status, "archive");
  assert.equal(archived.update_structure?.pinned_rank, null);
  assert.equal(archived.update_structure?.urgent_until, null);
  assert.deepEqual(archived.update_structure?.targets, originalResults);
  assert.equal((await testCase.workflow.adminArchiveMarketUpdate(42, false, archived.updated_at)).success, true);
  const restored = testCase.rows.get(42)!;
  assert.equal(restored.actuality_status, "current");
  assert.equal(restored.update_structure?.setup_status, "closed");
  assert.equal(restored.update_structure?.close_reason, "stopped");
  assert.equal(restored.update_structure?.closed_at, stamp);
  assert.deepEqual(restored.update_structure?.targets, originalResults);
});

test("workflow actions require admin, reject invalid payloads, and perform a conditional write", async () => {
  const denied = harness([row({ is_published: true })]);
  denied.deny();
  await assert.rejects(() => denied.workflow.adminUpdateMarketUpdateWorkflow(42, { action: "entry", expectedUpdatedAt: stamp }), /synthetic forbidden/);
  assert.equal(denied.calls.queries.length, 0);
  const testCase = harness([row({ is_published: true })]);
  for (const payload of [null, {}, { action: "follow_up", expectedUpdatedAt: stamp, note: {} }]) {
    assert.equal((await testCase.workflow.adminUpdateMarketUpdateWorkflow(42, payload)).success, false);
  }
  assert.equal(testCase.calls.queries.filter((query) => query.operation === "update").length, 0);
  const result = await testCase.workflow.adminUpdateMarketUpdateWorkflow(42, { action: "entry", expectedUpdatedAt: stamp });
  assert.equal(result.success, true, result.error);
  assert.equal(testCase.rows.get(42)?.update_structure?.setup_status, "running");
  const write = testCase.calls.queries.find((query) => query.operation === "update")!;
  assert.deepEqual(write.filters, [["id", 42], ["updated_at", stamp]]);
  const conflicted = harness([row({ is_published: true })]);
  conflicted.conflict();
  assert.match((await conflicted.workflow.adminUpdateMarketUpdateWorkflow(42, { action: "entry", expectedUpdatedAt: stamp })).error, /intussen gewijzigd/);
  assert.equal(conflicted.rows.get(42)?.update_structure?.setup_status, "waiting");
  assert.deepEqual(conflicted.calls.audit, []);
});

test("duplication makes independent chart objects and rewrites copy links while preserving the source", async () => {
  const metadata = structure();
  metadata.setup_status = "closed";
  metadata.close_reason = "stopped";
  metadata.closed_at = stamp;
  metadata.targets[0].reached_at = stamp;
  metadata.pinned_rank = 1;
  metadata.pin_until = "2099-10-16T12:00:00Z";
  metadata.urgent_until = metadata.pin_until;
  metadata.activity_at = stamp;
  metadata.fields.valid_until = "2099-10-16T12:00:00Z";
  metadata.fields.review_at = metadata.fields.valid_until;
  const source = row({
    is_published: true, published_at: stamp, update_structure: metadata, content_format: "chart", content_kind: "article",
    image_paths: ["weekly-updates/42/a.png", "weekly-updates/42/b.webp"],
    article_html: '<p>Originele uitleg.</p><img src="/api/market-updates/42/images/0">',
  });
  const testCase = harness([source]);
  const result = await testCase.workflow.adminDuplicateMarketUpdate(42);
  assert.equal(result.success, true, result.error);
  const duplicate = testCase.rows.get(result.weeklyUpdateId)!;
  assert.equal(duplicate.is_published, false);
  assert.equal(duplicate.published_at, null);
  assert.equal(duplicate.update_structure?.setup_status, "waiting");
  assert.deepEqual(duplicate.update_structure?.targets.map((target) => target.reached_at), [null, null]);
  assert.deepEqual(duplicate.update_structure?.history, []);
  assert.equal(duplicate.update_structure?.pinned_rank, null);
  assert.equal(duplicate.update_structure?.urgent_until, null);
  assert.equal(duplicate.update_structure?.fields.valid_until, "");
  assert.equal(duplicate.update_structure?.fields.review_at, "");
  assert.equal(testCase.calls.chartCopies.length, 2);
  assert.deepEqual(testCase.calls.chartCopies.map(([from]) => from), source.image_paths);
  assert.ok(duplicate.image_paths.every((path) => path.startsWith(`weekly-updates/${duplicate.id}/`)));
  assert.ok(duplicate.image_paths.every((path) => !source.image_paths.includes(path)));
  assert.ok(duplicate.article_html!.includes(`/api/market-updates/${duplicate.id}/images/0`));
  assert.deepEqual(testCase.rows.get(42), source);
  assert.deepEqual(testCase.calls.notifications, []);
});

test("duplication refreshes a generated body after schedule reset and preserves real additional commentary", async () => {
  for (const hasExtraBody of [false, true]) {
    const metadata = structure();
    metadata.fields.valid_until = "2099-10-16T12:00:00Z";
    metadata.fields.review_at = "2099-10-17T12:00:00Z";
    const source = row({ update_structure: metadata });
    source.body = hasExtraBody ? "Aanvullende toelichting die in de kopie behouden moet blijven." : marketEditing.structureFallbackBody(metadata, source.summary);
    const testCase = harness([source]);
    const result = await testCase.workflow.adminDuplicateMarketUpdate(source.id);
    assert.equal(result.success, true, result.error);
    const duplicate = testCase.rows.get(result.weeklyUpdateId)!;
    assert.equal(duplicate.body, hasExtraBody ? source.body : marketEditing.structureFallbackBody(duplicate.update_structure!, duplicate.summary));
    assert.ok(!duplicate.body!.includes("2099-10-16"));
    assert.deepEqual(testCase.rows.get(source.id), source);
  }
});

test("F3a structured create/edit keeps all explicit markets across every template without changing its meaning", async () => {
  for (const type of ["setup", "analysis", "news", "education"] as const) {
    const testCase = harness();
    const metadata = structure(type);
    const request = form(row({ update_structure: metadata }));
    request.set("is_published", "false");
    request.set("markets_present", "1");
    for (const market of ["forex", "gold", "trading", "indices", "macro", "general"]) request.append("markets", market);
    const created = await testCase.actions.adminCreateQuickMarketUpdate(request);
    assert.equal(created.success, true, created.error);
    const before = copy(testCase.rows.get(created.weeklyUpdateId)!);
    assert.deepEqual(before.markets, ["forex", "gold", "trading", "indices", "macro", "general"]);
    assert.equal(before.update_structure!.type, type);
    assert.equal(before.update_structure!.category, "forex");
    const edit = form(before);
    edit.set("markets_present", "1");
    for (const market of before.markets!) edit.append("markets", market);
    assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(before.id, edit)).success, true);
    const after = testCase.rows.get(before.id)!;
    assert.deepEqual(after.markets, before.markets);
    assert.deepEqual(after.update_structure, before.update_structure);
    for (const key of ["created_at", "published_at", "week_start_date", "slug", "created_by_student_id", "published_by_display_name"] as const) assert.deepEqual(after[key], before[key]);
  }
});

test("F3a old form omissions retain multi-market/chapters while explicit empty or unsupported tags fail without a write", async () => {
  const initial = row({ markets: ["crypto", "gold"], chapters: [{ title: "Goud", seconds: 10, market: "gold" }], video_duration_seconds: 60 });
  const testCase = harness([initial]);
  assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(initial.id, form(initial))).success, true);
  assert.deepEqual(testCase.rows.get(initial.id)!.markets, initial.markets);
  assert.deepEqual(testCase.rows.get(initial.id)!.chapters, initial.chapters);
  for (const tag of [null, "unsupported"]) {
    const before = copy(testCase.rows.get(initial.id)!);
    const request = form(before); request.set("markets_present", "1");
    if (tag) request.append("markets", tag);
    assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(initial.id, request)).success, false);
    assert.deepEqual(testCase.rows.get(initial.id), before);
  }
});

test("F3a validates chapter syntax, duration and selected market in the actual action before persistence", async () => {
  const initial = row({ content_format: "video", markets: ["crypto", "gold"], video_duration_seconds: 60 });
  const testCase = harness([initial]);
  for (const text of ["nonsense", "00:60 Fout", "00:00 Intro\n00:00 Dubbel", "01:00 Einde", "00:10 Forex | forex", "00:10 Goud | GOLD"]) {
    const request = form(initial); request.set("chapters", text);
    const result = await testCase.actions.adminUpdateWeeklyUpdate(initial.id, request);
    assert.equal(result.success, false, text);
    assert.deepEqual(testCase.rows.get(initial.id), initial);
  }
  const request = form(initial); request.set("chapters", "00:00 Intro\n00:10 Goud | gold");
  assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(initial.id, request)).success, true);
  assert.deepEqual(testCase.rows.get(initial.id)!.chapters, [{ title: "Intro", seconds: 0 }, { title: "Goud", seconds: 10, market: "gold" }]);
});

test("F3a explicit replacement without JSON metadata updates the compatibility category and does not resurrect removed tags", async () => {
  const initial = row({ markets: ["crypto", "forex"] });
  const testCase = harness([initial]);
  const request = form(initial); request.delete("update_structure"); request.set("markets_present", "1"); request.append("markets", "gold");
  assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(initial.id, request)).success, true);
  const saved = testCase.rows.get(initial.id)!;
  assert.deepEqual(saved.markets, ["gold"]);
  assert.equal(saved.update_structure!.category, "gold");
  assert.deepEqual(marketStructure.getUpdateMarkets(saved), ["gold"]);
});

test("F3a legacy quick composer keeps its body limits while accepting the expanded tags", async () => {
  for (const body of ["te kort", "x".repeat(12001)]) {
    const testCase = harness();const request=new FormData();request.set("body",body);request.append("markets","gold");
    assert.equal((await testCase.actions.adminCreateQuickMarketUpdate(request)).success,false);
    assert.equal(testCase.rows.size,0);
  }
});

test("F3a explicit empty outlook markets are rejected while an old omitted selection remains lossless", async () => {
  const initial = row({ type:"weekly_outlook",market:null,markets:["forex","gold"],update_structure:null,content_format:"video" });
  const testCase=harness([initial]);const request=form(initial);request.set("type","weekly_outlook");request.delete("update_structure");request.set("markets_present","1");
  const rejected=await testCase.actions.adminUpdateWeeklyUpdate(initial.id,request);assert.equal(rejected.success,false);assert.match(rejected.error,/minimaal één markt/);assert.deepEqual(testCase.rows.get(initial.id),initial);
  request.delete("markets_present");assert.equal((await testCase.actions.adminUpdateWeeklyUpdate(initial.id,request)).success,true);assert.deepEqual(testCase.rows.get(initial.id)!.markets,initial.markets);
});

test('F3b saving editorial context normalizes new takeaway prefixes without modifying article content or publication metadata',async()=>{
 const original=row({update_structure:null,summary:null,event_context:'CPI Rentebesluit',key_takeaways:['1. Oud inzicht.'],body:'Een volledig bestaand bericht met prijs 1.5% en historische inhoud.'});
 const testCase=harness([original]);const request=form(original);request.delete('update_structure');request.set('body',original.body!);request.set('event_context',original.event_context!);request.set('key_takeaways','1. Oud inzicht.\n2) Nieuw inzicht.\n1.5% blijft een waarde.');
 const result=await testCase.actions.adminUpdateWeeklyUpdate(original.id,request);assert.equal(result.success,true,result.error);const saved=testCase.rows.get(original.id)!;
 assert.deepEqual(saved.key_takeaways,['Oud inzicht.','Nieuw inzicht.','1.5% blijft een waarde.']);assert.equal(saved.body,original.body);assert.equal(saved.summary,null);assert.equal(saved.event_context,original.event_context);assert.equal(saved.slug,original.slug);assert.equal(saved.published_at,original.published_at);
});

 test("F3b saving context preserves the first market despite checkbox DOM order and still removes deselected tags",async()=>{
  const original=row({update_structure:null,markets:["gold","forex"],market:"gold"});const h=harness([original]);const request=form(original);request.delete("update_structure");request.set("markets_present","1");request.delete("markets");request.append("markets","forex");request.append("markets","gold");
  assert.equal((await h.actions.adminUpdateWeeklyUpdate(original.id,request)).success,true);assert.deepEqual(h.rows.get(original.id)!.markets,["gold","forex"]);
  request.delete("markets");request.append("markets","forex");assert.equal((await h.actions.adminUpdateWeeklyUpdate(original.id,request)).success,true);assert.deepEqual(h.rows.get(original.id)!.markets,["forex"]);
 });
