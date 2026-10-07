import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { jsx, jsxs } from "react/jsx-runtime";
import ts from "typescript";
import {
  canStudentAccessWeeklyUpdate,
  SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS,
} from "../../lib/weekly-update-access";
import { getMondayDate } from "../../lib/market-analysis";
import * as marketArticle from "../../lib/market-article";
import * as marketAuthor from "../../lib/market-update-author";
import * as marketPolicy from "../../lib/market-update-policy";

const sharedDependencies: Record<string, unknown> = {
  "@/lib/market-article": marketArticle,
  "@/lib/market-update-author": marketAuthor,
  "@/lib/market-update-policy": marketPolicy,
  "@/lib/supabase/service": {},
};

// Execute the real server modules with synthetic auth, data and provider
// boundaries. No Supabase, Stripe or Mux calls are made by these tests.
function loadModule(path: string, dependencies: Record<string, unknown>, env = {}) {
  const compiled = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const loadedModule = { exports: {} as Record<string, (...args: any[]) => any> };
  runInNewContext(compiled.outputText, {
    exports: loadedModule.exports,
    module: loadedModule,
    console,
    process: { env },
    require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs };
      if (name === "@/app/(protected)/market-analysis/[slug]/page") return loadModule("app/(protected)/market-analysis/[slug]/page.tsx", dependencies, env);
      if (name in sharedDependencies) return { ...sharedDependencies[name] as object, ...dependencies[name] as object };
      assert.ok(name in dependencies, `Missing mock for ${name}`);
      return dependencies[name];
    },
  });
  return loadedModule.exports;
}

function billing(paid: boolean) {
  const loadedModule = loadModule("lib/billing.ts", {
    "@/lib/supabase/server": {},
    "@/lib/supabase/service": {},
    "@/lib/billing-notifications": {},
    "@/lib/stripe": {},
  }, { PAID_PRODUCTS_ENABLED: paid ? "1" : "0" });
  return {
    paidProductsEnabled: () => paid,
    getBillingOverview: async () => ({ hasAccess: false }),
    canAccessSubscriberContent: loadedModule.canAccessSubscriberContent,
  };
}

test("admin can save an uploaded video for everyone without changing publication state", async () => {
  let saved: Record<string, unknown> | null = null;
  const actions = loadModule("app/actions/admin/weekly-updates.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/market-article": { sanitizeArticle: (value: string) => value },
    "@/lib/admin/access": { requireAdmin: async () => ({ actorStudent: { id: "synthetic-admin" } }) },
    "@/lib/admin/audit": { logAdminAction: () => {} },
    "@/lib/supabase/server": {},
    "@/lib/admin/weekly-updates": {
      getWeeklyUpdateAdmin: async () => ({
        ...videoFixture("subscription"),
        week_start_date: "2026-10-05",
        is_published: true,
        mux_status: "ready",
      }),
      updateWeeklyUpdateAdmin: async (_id: number, input: Record<string, unknown>) => {
        saved = input;
        return { error: null };
      },
    },
    "@/lib/admin/weekly-update-notifications": {},
    "@/lib/mux": {},
    "@/lib/transcription/mux-captions": {},
    "@/lib/transcription/start-policy": {},
    "@/lib/transcription/cost-policy": {},
    "@/lib/weekly-update-access": { SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS },
    "@/lib/market-analysis": { getMondayDate },
  });
  const form = new FormData();
  form.set("title", "Synthetische update");
  form.set("slug", "synthetic-update");
  form.set("type", "market_update");
  form.set("markets", "crypto");
  form.set("access_tier", "free");
  form.set("is_published", "on");
  const result = await actions.adminUpdateWeeklyUpdate(1, form);
  assert.equal(result.success, true);
  assert.ok(saved);
  assert.equal((saved as Record<string, unknown>).access_tier, "free");
  assert.equal((saved as Record<string, unknown>).is_published, true);
  assert.equal((saved as Record<string, unknown>).published_at, "2026-10-07T10:00:00Z");

  form.set("access_tier", "subscription");
  assert.equal((await actions.adminUpdateWeeklyUpdate(1, form)).success, true);
  assert.equal((saved as Record<string, unknown>).access_tier, "subscription");
  form.set("access_tier", "premium");
  assert.equal((await actions.adminUpdateWeeklyUpdate(1, form)).success, false);
});

const Video = () => null;
const Paywall = () => null;
const Library = () => null;
const NOT_FOUND = new Error("synthetic not found");
const freeStudent = { id: "student-free", access_level: 1 };

function videoFixture(accessTier = "free") {
  return {
    id: 1,
    slug: "synthetic-update",
    title: "Synthetische update",
    access_tier: accessTier,
    type: "market_update",
    content_format: "video",
    content_kind: "video",
    market: "crypto",
    published_at: "2026-10-07T10:00:00Z",
    key_takeaways: [],
    mux_playback_id: "synthetic-playback",
    mux_playback_policy: "signed",
  };
}

function detailPage(path: string, {
  paid = false,
  student = freeStudent as typeof freeStudent | null,
  update = videoFixture() as ReturnType<typeof videoFixture> | null,
} = {}) {
  const calls = { tokens: 0, enrichment: 0, reads: 0 };
  const page = loadModule(path, {
    "next/link": { default: () => null },
    "next/navigation": { notFound: () => { throw NOT_FOUND; } },
    "@/components/WeeklyUpdateAutoCompleteVideo": { WeeklyUpdateAutoCompleteVideo: Video },
    "@/components/market-insight/MarketPostLayout": { MarketPostLayout: () => null },
    "@/components/market-insight/MarketPostContents": { MarketPostContents: () => null },
    "@/lib/market-post-detail": { getMarketPostDetailMeta: async () => ({ author: null, reaction: { total: 0, active: false } }) },
    "@/lib/market-article": { articleReadingMinutes: () => null },
    "@/components/layout/PageHeader": { PageHeader: () => null },
    "@/lib/market-analysis": {
      getIsoWeekNumber: () => 41,
      getMarketAnalysisTypeLabel: () => "Marktbreakdown",
      getMarketLabel: () => "Crypto",
    },
    "@/lib/weekly-updates": {
      getPublishedWeeklyUpdateBySlug: async () => { calls.reads++; return update; },
      getPublishedEnrichmentForWeeklyUpdate: async () => { calls.enrichment++; return null; },
    },
    "@/lib/students": { ensureCurrentStudent: async () => ({ student }) },
    "@/lib/billing": billing(paid),
    "@/components/billing/SubscriptionPaywall": { SubscriptionPaywall: Paywall },
    "@/lib/mux-signing": { getMuxPlaybackTokens: () => { calls.tokens++; return { playback: "synthetic-token" }; } },
    "@/lib/weekly-update-access": { canStudentAccessWeeklyUpdate },
  }).default;
  return { render: () => page({ params: Promise.resolve({ slug: "synthetic-update" }) }), calls };
}

test("admin can select everyone while legacy audiences stay disabled", () => {
  assert.deepEqual(SELECTABLE_WEEKLY_UPDATE_ACCESS_TIERS, ["free", "subscription"]);
  assert.equal(canStudentAccessWeeklyUpdate("free", freeStudent), true);
  assert.equal(canStudentAccessWeeklyUpdate("free", null, true), false);
  assert.equal(canStudentAccessWeeklyUpdate("subscription", freeStudent), false);
});

for (const path of [
  "app/(protected)/market-analysis/[slug]/page.tsx",
  "app/(protected)/updates/watch/[slug]/page.tsx",
]) {
  for (const paid of [false, true]) {
    test(`${path}: free account plays a released signed video (billing=${paid})`, async () => {
      const { render, calls } = detailPage(path, { paid });
      const result = await render();
      assert.notEqual(result.type, Paywall);
      assert.equal(calls.tokens, 1);
    });

    test(`${path}: restricted video never issues tokens or reads enrichment (billing=${paid})`, async () => {
      const { render, calls } = detailPage(path, { paid, update: videoFixture("subscription") });
      if (paid) assert.equal((await render()).type, Paywall);
      else await assert.rejects(render, (error) => error === NOT_FOUND);
      assert.equal(calls.tokens, 0);
      assert.equal(calls.enrichment, 0);
    });
  }

  test(`${path}: an RLS-hidden video retains the subscription paywall`, async () => {
    const { render, calls } = detailPage(path, { paid: true, update: null });
    assert.equal((await render()).type, Paywall);
    assert.equal(calls.tokens, 0);
  });

  test(`${path}: Academy and admin keep pre-billing access`, async () => {
    for (const access_level of [2, 3]) {
      const { render, calls } = detailPage(path, {
        student: { id: "synthetic-student", access_level },
        update: videoFixture("subscription"),
      });
      await render();
      assert.equal(calls.tokens, 1);
    }
  });

  test(`${path}: anonymous users never load the video`, async () => {
    const { render, calls } = detailPage(path, { student: null });
    assert.equal(await render(), null);
    assert.equal(calls.reads, 0);
    assert.equal(calls.tokens, 0);
  });
}

for (const paid of [false, true]) {
  test(`library queries exclude drafts and restricted videos before limiting results (billing=${paid})`, async () => {
    const rows = [
      { ...videoFixture("subscription"), id: 3, is_published: true },
      { ...videoFixture(), id: 2, is_published: false },
      { ...videoFixture(), id: 1, is_published: true },
    ];
    let serviceReads = 0;
    let authenticatedReads = 0;
    const db = {
      from(table: string) {
        assert.equal(table, "weekly_updates");
        const filters: Array<[string, unknown]> = [];
        let limit = rows.length;
        const query = {
          select: () => query,
          eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
          order: () => query,
          limit: (value: number) => { limit = value; return query; },
          then(onResult: (result: { data: typeof rows; error: null }) => unknown) {
            return Promise.resolve(onResult({
              data: rows.filter((row) => filters.every(([key, value]) => row[key as keyof typeof row] === value)).slice(0, limit),
              error: null,
            }));
          },
        };
        return query;
      },
    };
    const queries = loadModule("lib/weekly-updates.ts", {
      "@/lib/supabase/server": { createClient: async () => { authenticatedReads++; return db; } },
      "@/lib/supabase/service": { createServiceClient: () => { serviceReads++; return db; } },
      "@/lib/billing": { paidProductsEnabled: () => paid },
      "@/lib/transcription/public-enrichment": {},
    });
    const allMarkets = await queries.listPublishedWeeklyUpdates(1, { freeOnly: true });
    const crypto = await queries.listPublishedMarketUpdatesByMarket("crypto", 1, { freeOnly: true });
    assert.equal(allMarkets.length, 1);
    assert.equal(allMarkets[0].id, 1);
    assert.equal(crypto.length, 1);
    assert.equal(crypto[0].id, 1);
    assert.equal(serviceReads, paid ? 0 : 2);
    assert.equal(authenticatedReads, paid ? 2 : 0);
  });
}

for (const path of [
  "app/(protected)/market-analysis/page.tsx",
  "app/(protected)/updates/[market]/page.tsx",
]) {
  test(`${path}: free library requests only released videos before billing rollout`, async () => {
    let filtered = false;
    const list = async (...args: any[]) => {
      filtered = args.at(-1).freeOnly === true;
      return [videoFixture()];
    };
    const page = loadModule(path, {
      "next/navigation": { notFound: () => { throw NOT_FOUND; } },
      "@/components/layout/PageHeader": { PageHeader: () => null },
      "@/components/market-insight/MarketInsightLibrary": { MarketInsightLibrary: Library },
      "@/components/updates/MarketUpdatesLibrary": { MarketUpdatesLibrary: Library },
      "@/components/billing/SubscriptionPaywall": { SubscriptionPaywall: Paywall },
      "@/lib/market-analysis": { MARKET_OPTIONS: [{ value: "crypto", label: "Crypto" }] },
      "@/lib/billing": billing(false),
      "@/lib/students": { ensureCurrentStudent: async () => ({ student: freeStudent }) },
      "@/lib/weekly-updates": { listPublishedWeeklyUpdates: list, listPublishedMarketUpdatesByMarket: list },
    }).default;
    const result = await page({ params: Promise.resolve({ market: "crypto" }), searchParams: Promise.resolve({}) });
    assert.equal(filtered, true);
    assert.notEqual(result.type, Paywall);
  });
}
