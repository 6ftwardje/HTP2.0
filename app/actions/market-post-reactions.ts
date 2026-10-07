"use server";

import { createClient } from "@/lib/supabase/server";

export async function setMarketPostReaction(postId: number, active: boolean) {
  if (!Number.isSafeInteger(postId) || postId < 1 || typeof active !== "boolean") return { error: "Ongeldige reactie." };
  const db = await createClient();
  const { data, error } = await db.rpc("set_market_post_reaction", { p_post_id: postId, p_active: active });
  if (error || !data?.[0]) return { error: "Je reactie kon niet worden opgeslagen. Controleer je toegang en probeer opnieuw." };
  // No route refresh/revalidation: player/token props must remain stable.
  return { state: { total: Number(data[0].total), active: Boolean(data[0].active) } };
}
