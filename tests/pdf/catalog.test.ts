import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queryVisibleDocuments } from "../../lib/pdf/catalog-query";
import { logError } from "../../lib/logger";

test("a missing RPC is logged with the original PostgREST error and never becomes an empty catalogue", async (t) => {
  const output = t.mock.method(console, "error", () => {});
  const original = { code: "PGRST202", message: "Function missing", details: "Schema cache", hint: "Apply migration" };
  const db = { rpc: () => ({ range: async () => ({ data: null, error: original, status: 404 }) }) } as unknown as SupabaseClient;
  await assert.rejects(queryVisibleDocuments(db, "update", [17]), (error: Error) => error.cause === original);
  const entry = JSON.parse(output.mock.calls[0].arguments[0]);
  assert.equal(entry.event, "pdf.catalog.rpc_failed");
  assert.deepEqual(entry.parentIds, [17]); assert.equal(entry.status, 404);
  assert.equal(entry.kind, "update"); assert.equal(entry.rpc, "list_visible_pdf_documents");
  assert.deepEqual(entry.error, original);
});

test("empty parents do not call the RPC and a valid empty result stays empty", async () => {
  let calls = 0;
  const db = { rpc: () => { calls++; return { range: async () => ({ data: [], error: null }) }; } } as unknown as SupabaseClient;
  assert.deepEqual(await queryVisibleDocuments(db, "update", []), []); assert.equal(calls, 0);
  assert.deepEqual(await queryVisibleDocuments(db, "update", [17]), []); assert.equal(calls, 1);
});

test("catalogue paginates both parents and attachments and rejects a partially failed archive", async (t) => {
  t.mock.method(console, "error", () => {});
  const ranges: number[][] = [], batches: number[][] = [];
  const db = { rpc: (_name: string, args: {p_parent_ids:number[]}) => { batches.push(args.p_parent_ids); return { range: async (from: number, to: number) => {
    ranges.push([from, to]);
    return { data: Array.from({length: from === 0 && args.p_parent_ids.length === 100 ? 250 : 1}, () => ({id:"visible"})), error: null };
  } }; } } as unknown as SupabaseClient;
  assert.equal((await queryVisibleDocuments(db, "update", Array.from({length:101},(_,i)=>i+1))).length, 252);
  assert.deepEqual(ranges, [[0,249],[250,499],[0,249]]); assert.deepEqual(batches.map(b=>b.length),[100,100,1]);
  let call = 0;
  const failing = { rpc: () => ({ range: async () => ++call === 1 ? {data: Array(250).fill({id:"visible"}), error:null} : {data:null,error:{code:"57014",message:"Timeout"},status:500} }) } as unknown as SupabaseClient;
  await assert.rejects(queryVisibleDocuments(failing,"module",[1]), /documenten/);
});

test("thrown transport failures and nested causes retain diagnostic context", async (t) => {
  const output = t.mock.method(console,"error",()=>{}), original = new TypeError("Fetch failed");
  const db = { rpc: () => ({ range: async () => { throw original; } }) } as unknown as SupabaseClient;
  await assert.rejects(queryVisibleDocuments(db,"update",[17]), error=>error===original);
  assert.equal(JSON.parse(output.mock.calls[0].arguments[0]).event,"pdf.catalog.request_failed");
  const boundary = Object.assign(new Error("Documents unavailable",{cause:{code:"PGRST202",message:"Missing RPC"}}),{digest:"418920492"});
  logError("market.detail.render_failed",boundary,{pathname:"/market-analysis/example"});
  const entry=JSON.parse(output.mock.calls[1].arguments[0]);
  assert.equal(entry.error.cause.code,"PGRST202");assert.equal(entry.error.digest,"418920492");
  logError("extended.error",Object.assign(new Error("Missing function"),{code:"PGRST202",details:"Schema cache"}));
  assert.equal(JSON.parse(output.mock.calls[2].arguments[0]).error.code,"PGRST202");
  const cyclic=new Error("Cycle");cyclic.cause=cyclic;
  assert.doesNotThrow(()=>logError("cycle",cyclic));
});
