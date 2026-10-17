import { createClient } from "@/lib/supabase/server";
import type { FeedUpdate } from "@/lib/market-feed";
import { marketUpdateAuthorName } from "@/lib/market-update-author";

export type FeedAuthor = { name: string; object_path: string | null; student_id?: string };
export type FeedAuthors = Record<number, FeedAuthor>;
/** Existing access-checked RPC, once per credited author; never sends private profiles to the client. */
export async function getMarketFeedAuthors(updates: readonly FeedUpdate[]): Promise<FeedAuthors> {
  const db = await createClient();
  const groups = new Map<string, FeedUpdate[]>();
  for (const update of updates.filter((item) => item.is_published)) {
    const article = update.content_format !== "video" || update.content_kind === "article";
    const id = (article ? update.published_by_student_id : null) || update.mentor_student_id || update.created_by_student_id || `post-${update.id}`;
    const key = `${id}:${article ? update.published_by_display_name ?? "article" : "video"}`;
    groups.set(key, [...(groups.get(key) ?? []), update]);
  }
  const authors: FeedAuthors = {};
  await Promise.all([...groups.values()].map(async (group) => {
    const { data } = await db.rpc("market_post_author", { p_post_id: group[0].id });
    const author = data?.[0] as FeedAuthor | undefined;
    for (const update of group) authors[update.id] = {
      name: (update.content_format !== "video" || update.content_kind === "article") && update.published_by_display_name?.trim() || author?.name || marketUpdateAuthorName(update),
      object_path: author?.object_path ?? null,
      ...(author?.student_id ? { student_id: author.student_id } : {}),
    };
  }));
  return authors;
}
