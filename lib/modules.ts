import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import type { Module } from "@/lib/types";

const LEGACY_MODULE_COLUMNS =
  "id, title, slug, description, short_description, order_index, thumbnail_url, is_published";
const MODULE_COLUMNS =
  `${LEGACY_MODULE_COLUMNS}, is_free`;

type ModuleQueryError = { code?: string; message: string };
type ModuleQueryResult = { data: unknown; error: ModuleQueryError | null };

/** Keep the catalog readable while the access-setting migration is rolling out. */
async function readModuleQuery(
  query: (columns: string) => PromiseLike<ModuleQueryResult>
): Promise<unknown> {
  let result = await query(MODULE_COLUMNS);
  if (
    result.error &&
    ["42703", "PGRST204"].includes(result.error.code ?? "") &&
    /(?:\bmodules\.is_free\b|["']is_free["'])/i.test(result.error.message)
  ) {
    logError("modules.free_setting_not_migrated", result.error);
    result = await query(LEGACY_MODULE_COLUMNS);
  }

  if (result.error) {
    logError("modules.query_failed", result.error);
    throw new Error("De modules konden niet worden geladen. Probeer het opnieuw.");
  }
  return result.data;
}

function normalizeModule(module: Module): Module {
  // Missing configuration never grants additional free access.
  return { ...module, is_free: module.is_free === true };
}

export async function getPublishedModules(): Promise<Module[]> {
  const supabase = await createClient();
  const data = await readModuleQuery((columns) => supabase
    .from("modules")
    .select(columns)
    .eq("is_published", true)
    .order("order_index", { ascending: true })
    .order("id", { ascending: true }));

  return ((data ?? []) as Module[]).map(normalizeModule);
}

export async function getModuleBySlug(slug: string): Promise<Module | null> {
  const supabase = await createClient();
  const data = await readModuleQuery((columns) => supabase
    .from("modules")
    .select(columns)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle());

  return data ? normalizeModule(data as Module) : null;
}

export async function getModuleById(moduleId: number): Promise<Module | null> {
  const supabase = await createClient();
  const data = await readModuleQuery((columns) => supabase
    .from("modules")
    .select(columns)
    .eq("id", moduleId)
    .eq("is_published", true)
    .maybeSingle());

  return data ? normalizeModule(data as Module) : null;
}
