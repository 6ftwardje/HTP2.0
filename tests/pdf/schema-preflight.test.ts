import assert from "node:assert/strict";
import test from "node:test";
import { verifyMarketSchema } from "../../scripts/verify-market-schema.mjs";

test("deployment preflight rejects missing RPCs, permissions and incomplete table metadata", async () => {
  const db = (rpcError: unknown, tableError: unknown = null) => ({
    rpc: async () => ({error:rpcError,status:404}),
    from: () => ({select: () => ({limit: async () => ({error:tableError})})}),
  });
  await assert.rejects(verifyMarketSchema(db({code:"PGRST202",message:"Missing RPC"})),/list_visible_pdf_documents.*PGRST202/);
  await assert.rejects(verifyMarketSchema(db({code:"42501",message:"Permission denied"})),/list_visible_pdf_documents/);
  await assert.rejects(verifyMarketSchema(db(null,{code:"42703",message:"Missing column"})),/pdf_documents.*42703/);
  await verifyMarketSchema({ ...db(null), rpc:async (name:string)=>({error:name==="read_pdf_position"?{code:"42501"}:null}) });
});
