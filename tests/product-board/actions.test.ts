import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as policy from "../../lib/product-board";

const taskId = "00000000-0000-0000-0000-000000000010";
function harness({ denied = false, conflict = false, dbError = false, ownerAdmin = true } = {}) {
  const calls: { table: string; patch?: Record<string, unknown>; filters: unknown[][] }[] = [];
  let audits = 0, refreshes = 0;
  const db = { from(table: string) {
    const trace = { table, filters: [] as unknown[][], patch: undefined as Record<string, unknown> | undefined }; calls.push(trace);
    const query = {
      select: () => query, insert: (patch: Record<string, unknown>) => { trace.patch = patch; return query; },
      update: (patch: Record<string, unknown>) => { trace.patch = patch; return query; },
      eq: (k: string, v: unknown) => { trace.filters.push([k,v]); return query; },
      maybeSingle: async () => ({ data: table === "students" ? ownerAdmin ? { id: taskId } : null : conflict ? null : { id: taskId }, error: dbError ? { message: "internal" } : null }),
    }; return query;
  } };
  const dependencies: Record<string, unknown> = {
    "@/lib/admin/access": { requireAdmin: async () => { if (denied) throw new Error("Forbidden"); return { actorStudent: { id: taskId } }; } },
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/admin/audit": { logAdminAction: async () => { audits++; } },
    "next/cache": { revalidatePath: () => { refreshes++; } }, "@/lib/product-board": policy,
  };
  const mod = { exports: {} as { saveTeamTask: (id: string | null, version: number, form: FormData) => Promise<{ success: boolean; error?: string }>; saveBoardCycle: (version: number, form: FormData) => Promise<{ success: boolean; error?: string }> } };
  const compiled = ts.transpileModule(readFileSync("app/actions/admin/product-board.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  runInNewContext(compiled.outputText, { exports: mod.exports, module: mod, FormData, require: (name: string) => { assert.ok(name in dependencies); return dependencies[name]; } });
  return { ...mod.exports, calls, auditCount: () => audits, refreshCount: () => refreshes };
}
const form = () => { const f = new FormData(); Object.entries({ title: "Sessie voorbereiden", priority: "P2", status: "todo" }).forEach(([k,v]) => f.set(k,v)); return f; };
test("direct actions authorize before any data access", async () => {
  const h = harness({ denied: true });
  await assert.rejects(h.saveTeamTask(null, 0, form()), /Forbidden/);
  await assert.rejects(h.saveBoardCycle(0, form()), /Forbidden/);
  assert.equal(h.calls.length, 0);
});
test("task updates compare version and report concurrent edits without claiming success", async () => {
  const h = harness({ conflict: true }); const r = await h.saveTeamTask(taskId, 3, form());
  assert.equal(r.success, false); assert.match(r.error!, /intussen/);
  assert.deepEqual(h.calls[0].filters, [["id", taskId], ["version", 3]]);
  assert.equal(h.calls[0].patch?.version, 4); assert.equal(h.auditCount(), 0); assert.equal(h.refreshCount(), 0);
});
test("inserts attribute creator on the server and await audit/refresh", async () => {
  const h = harness(); const data = form(); data.set("created_by", "untrusted-client");
  assert.equal((await h.saveTeamTask(null, 0, data)).success, true);
  assert.equal(h.calls[0].patch?.created_by, taskId); assert.equal(h.auditCount(), 1); assert.equal(h.refreshCount(), 1);
});
test("invalid/non-admin owners and invalid done transitions never write tasks", async () => {
  const h = harness({ ownerAdmin: false }); const f = form(); f.set("owner_id", taskId);
  assert.equal((await h.saveTeamTask(null, 0, f)).success, false);
  assert.equal(h.calls.filter(c => c.table === "product_board_tasks").length, 0);
  f.set("status", "done"); assert.equal((await h.saveTeamTask(null, 0, f)).success, false);
});
test("database failures return a recoverable error without exposing internal details", async () => {
  const h = harness({ dbError: true }); const r = await h.saveTeamTask(taskId, 0, form());
  assert.equal(r.success, false); assert.doesNotMatch(r.error!, /internal/); assert.equal(h.auditCount(), 0);
});
test("cycle updates use the same concurrency guard", async () => {
  const h = harness({ conflict: true }); const f = form();
  Object.entries({ board: "team", goal: "Test de productflow", starts_on: "2026-10-19", ends_on: "2026-10-30" }).forEach(([k,v]) => f.set(k,v));
  assert.equal((await h.saveBoardCycle(2, f)).success, false);
  assert.deepEqual(h.calls[0].filters, [["board", "team"], ["version", 2]]);
});
