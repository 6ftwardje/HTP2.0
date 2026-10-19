import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

export type PdfListing = {
  id: string; title: string; description: string; page_count: number; version: string;
  shelf: "course" | "toolbox"; sort_order: number; has_cover: boolean; reading_available: boolean;
  module_id: number | null; weekly_update_id: number | null;
};

/** Only the access-checked SQL projection; never source paths or reading content. */
export async function queryVisibleDocuments(db: SupabaseClient, kind: "update" | "module", parents: number[]): Promise<PdfListing[]> {
  const rows: PdfListing[] = [];
  for (let start = 0; start < parents.length; start += 100) {
    const parentIds = parents.slice(start, start + 100);
    for (let offset = 0; ; offset += 250) {
      let result;
      try {
        result = await db.rpc("list_visible_pdf_documents", {
          p_kind: kind, p_parent_ids: parentIds,
        }).range(offset, offset + 249);
      } catch (error) {
        // Supabase normally returns an error object; transport/client failures can throw.
        logError("pdf.catalog.request_failed", error, { rpc: "list_visible_pdf_documents", kind, parentIds, offset });
        throw error;
      }
      const { data, error, status } = result;
      if (error) {
        logError("pdf.catalog.rpc_failed", error, { rpc: "list_visible_pdf_documents", kind, parentIds, offset, status });
        throw new Error("De documenten konden niet worden geladen. Probeer opnieuw.", { cause: error });
      }
      rows.push(...(data ?? []) as PdfListing[]);
      if (!data || data.length < 250) break;
    }
  }
  return rows;
}
