import { createClient } from "@/lib/supabase/server";

export async function getMarketPostDetailMeta(postId: number) {
  const db = await createClient();
  const [author, reaction] = await Promise.all([
    db.rpc("market_post_author", { p_post_id: postId }),
    db.rpc("market_post_reaction_state", { p_post_id: postId }),
  ]);
  return {
    author: author.data?.[0] as { name: string; object_path: string | null; student_id: string } | undefined,
    reaction: reaction.error ? null : { total: Number(reaction.data?.[0]?.total ?? 0), active: Boolean(reaction.data?.[0]?.active) },
  };
}

export async function getOwnAvatar(studentId: string): Promise<string | null> {
  const db = await createClient();
  const { data } = await db.from("student_avatars").select("object_path").eq("student_id", studentId).maybeSingle();
  return data?.object_path ?? null;
}
