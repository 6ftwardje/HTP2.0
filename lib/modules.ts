import { createClient } from "@/lib/supabase/server";
import type { Module } from "@/lib/types";

export async function getPublishedModules(): Promise<Module[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (error) return [];
  return (data ?? []) as Module[];
}

export async function getModuleBySlug(slug: string): Promise<Module | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modules")
    .select("*")
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
    .select("*")
    .eq("id", moduleId)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Module;
}
