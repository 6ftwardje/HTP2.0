import type { MarketInsightChapter } from "@/lib/types";

export function parseVideoTimestamp(value: string | null | undefined): number | null {
  if (value == null || !value.trim()) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  const match = /^(?:(\d+):)?(\d+):(\d{2})$/.exec(text);
  if (!match || Number(match[3]) > 59 || (match[1] !== undefined && Number(match[2]) > 59)) return null;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function activeMarketChapter(chapters: readonly MarketInsightChapter[], seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return -1;
  let active = -1;
  for (let index = 0; index < chapters.length && chapters[index].seconds <= seconds; index++) active = index;
  return active;
}

export function supportsMarketSeeking(provider: string | null | undefined) {
  return provider === "mux" || provider === "vimeo";
}
