import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as policy from "../../lib/product-board";

const fallback: policy.DevelopmentSnapshot = { syncedAt: "2026-10-18T00:00:00Z", projectUrl: policy.PROJECT_URL, items: [] };
function harness(fetcher: typeof fetch, token = "synthetic-token", denied = false) {
  const dependencies: Record<string, unknown> = {
    "server-only": {}, "@/lib/product-board": policy, "@/lib/data/development-board.json": fallback,
    "@/lib/supabase/server": { createClient: () => { throw new Error("Unexpected database access"); } },
    "@/lib/admin/access": { requireAdmin: () => { if (denied) throw new Error("Forbidden"); } },
  };
  const mod = { exports: {} as { getDevelopmentBoard: () => Promise<typeof fallback & { live: boolean; warning: string | null; items: policy.BoardItem[] }>; getProductBoard: () => Promise<unknown> } };
  const compiled = ts.transpileModule(readFileSync("lib/admin/product-board.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  runInNewContext(compiled.outputText, { exports: mod.exports, module: mod, Date, AbortSignal, fetch: fetcher, process: { env: { GITHUB_PROJECT_READ_TOKEN: token } }, require: (name: string) => { assert.ok(name in dependencies); return dependencies[name]; } });
  return mod.exports;
}
const response = (status: string, more = false) => new Response(JSON.stringify({ data: { user: { projectV2: { items: {
  pageInfo: { hasNextPage: more, endCursor: more ? "next-page" : null },
  nodes: [{ id: status, content: { title: "A feature", body: "", repository: { nameWithOwner: "6ftwardje/HTP2.0" } }, fieldValues: { nodes: [{ name: status, field: { name: "Status" } }] } }],
} } } } }));
test("live reads bypass stale caches and follow the latest GitHub project status", async () => {
  let status = "In uitvoering";
  const board = harness(async (_url, init) => { assert.equal(init?.cache, "no-store"); return response(status); });
  assert.equal((await board.getDevelopmentBoard()).items[0].status, "doing");
  status = "Done";
  const latest = await board.getDevelopmentBoard(); assert.equal(latest.live, true); assert.equal(latest.items[0].status, "done");
});
test("live project reads paginate without silently omitting later cards", async () => {
  let calls = 0;
  const board = harness(async (_url, init) => { calls++; const cursor = JSON.parse(String(init?.body)).variables.cursor; assert.equal(cursor, calls === 1 ? null : "next-page"); return response(calls === 1 ? "Backlog" : "Done", calls === 1); });
  assert.equal((await board.getDevelopmentBoard()).items.length, 2); assert.equal(calls, 2);
});
test("GitHub outage and missing credentials produce an explicit dated fallback", async () => {
  const unavailable = await harness(async () => new Response("Unavailable", { status: 503 })).getDevelopmentBoard();
  assert.equal(unavailable.live, false); assert.equal(unavailable.syncedAt, fallback.syncedAt); assert.ok(unavailable.warning);
  const unconfigured = await harness(async () => { throw Error("No fetch expected"); }, "").getDevelopmentBoard();
  assert.equal(unconfigured.live, false); assert.equal(unconfigured.warning, null);
});
test("reading private GitHub progress authorizes before contacting GitHub or the database", async () => {
  const board = harness(async () => { throw Error("No fetch expected"); }, "synthetic-token", true);
  await assert.rejects(board.getProductBoard(), /Forbidden/);
});
