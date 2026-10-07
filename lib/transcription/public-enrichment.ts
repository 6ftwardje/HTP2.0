export type PublishedVideoEnrichment = {
  summary: string;
  keyTakeaways: string[];
  chapters: Array<{ title: string; seconds: number }>;
  publishedAt: string;
};

export function projectPublishedVideoEnrichment(row: {
  status?: string | null;
  summary?: string | null;
  key_takeaways?: unknown;
  chapters?: unknown;
  published_at?: string | null;
}): PublishedVideoEnrichment | null {
  if (row.status !== "published" || !row.summary || !row.published_at) return null;
  return {
    summary: row.summary,
    keyTakeaways: Array.isArray(row.key_takeaways)
      ? (row.key_takeaways as string[])
      : [],
    chapters: Array.isArray(row.chapters)
      ? (row.chapters as Array<{ title: string; seconds: number }>)
      : [],
    publishedAt: row.published_at,
  };
}
