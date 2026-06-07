import { createClient } from "@/lib/supabase/server";
import type { Module } from "@/lib/types";

const MODULE_COLUMNS =
  "id, title, slug, description, short_description, order_index, thumbnail_url, is_published";

export async function getPublishedModules(): Promise<Module[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select(MODULE_COLUMNS)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (error) return [];
  return (data ?? []) as Module[];
}

export async function getModuleBySlug(slug: string): Promise<Module | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select(MODULE_COLUMNS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Module;
}

export async function getModuleById(moduleId: number): Promise<Module | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select(MODULE_COLUMNS)
    .eq("id", moduleId)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Module;
}
