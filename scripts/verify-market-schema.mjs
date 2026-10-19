import { createClient } from "@supabase/supabase-js";

/** Read-only deployment prerequisite: never applies migrations or writes data. */
export async function verifyMarketSchema(db) {
  for (const [rpc, parameters] of [
    ["list_visible_pdf_documents", { p_kind: "update", p_parent_ids: [-1] }],
    ["read_video_position", { p_kind: "update", p_content_id: -1 }],
    ["read_pdf_position", { p_document_id: "00000000-0000-0000-0000-000000000000", p_version: "00000000-0000-0000-0000-000000000000" }],
  ]) {
    const { error, status } = await db.rpc(rpc, parameters);
    // The nonexistent document must be denied by the actual function body.
    if (["read_pdf_position", "read_video_position"].includes(rpc) && error?.code === "42501") continue;
    if (error) throw new Error(`${rpc}: HTTP ${status}, ${error.code}: ${error.message}`);
  }
  const { error } = await db.from("pdf_documents").select("id,description,sort_order,shelf,cover_path").limit(0);
  if (error) throw new Error(`pdf_documents: ${error.code}: ${error.message}`);
}

async function main() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error("Market schema verification requires the deployment Supabase URL and service key.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await verifyMarketSchema(db);
  console.log("PASS: deployed market PDF schema and access gates are callable.");
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
