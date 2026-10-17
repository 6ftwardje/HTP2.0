import type { MarketInsightChapter, UpdateMarket } from "@/lib/types";
import { isUpdateMarket } from "@/lib/market-update-structure";

/** One chapter contract for manual and legacy content. AI publication remains a separate gate. */
export function validateMarketChapters(value: unknown, duration?: number | null, markets?: readonly UpdateMarket[]): string | null {
  if (!Array.isArray(value) || value.length > 200) return "Gebruik maximaal 200 hoofdstukken.";
  let previous = -1;
  for (const chapter of value) {
    if (!chapter || typeof chapter !== "object" || Array.isArray(chapter)
      || Object.keys(chapter).some((key) => !["title", "seconds", "market"].includes(key))
      || typeof chapter.title !== "string" || !chapter.title.trim() || chapter.title.length > 240
      || !Number.isSafeInteger(chapter.seconds) || chapter.seconds < 0) return "Geef ieder hoofdstuk een titel en een geldig tijdstip in hele seconden.";
    if (chapter.seconds <= previous) return "Zet hoofdstukken in oplopende volgorde, zonder dubbele tijdstippen.";
    if (duration != null && duration > 0 && chapter.seconds >= duration) return "Een hoofdstuk moet vóór het einde van de video beginnen.";
    if (chapter.market !== undefined && (!isUpdateMarket(chapter.market) || (markets && !markets.includes(chapter.market)))) return "Kies voor elk hoofdstuk een markt die ook bij de update is geselecteerd.";
    previous = chapter.seconds;
  }
  return null;
}

/** Existing MM:SS Title / HH:MM:SS Title syntax, with optional ` | market` suffix. */
export function parseMarketChapters(text: unknown): { chapters: MarketInsightChapter[]; error?: never } | { error: string; chapters?: never } {
  if (text == null || text === "") return { chapters: [] };
  if (typeof text !== "string") return { error: "De hoofdstukken konden niet worden gelezen." };
  const chapters: MarketInsightChapter[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = /^(?:(\d+):)?(\d+):(\d{2})\s+(.+?)(?:\s+\|\s*(\S+))?$/.exec(line.trim());
    if (!match || Number(match[3]) > 59 || (match[1] !== undefined && Number(match[2]) > 59)
      || (match[5] !== undefined && !isUpdateMarket(match[5]))) return { error: `Hoofdstukregel ${index + 1} is ongeldig. Gebruik mm:ss Titel, optioneel gevolgd door | marktcode.` };
    chapters.push({ title: match[4].trim(), seconds: Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]), ...(match[5] ? { market: match[5] as UpdateMarket } : {}) });
  }
  const error = validateMarketChapters(chapters);
  return error ? { error } : { chapters };
}

export function formatMarketChapters(chapters: readonly MarketInsightChapter[]) {
  return chapters.map((chapter) => `${Math.floor(chapter.seconds / 60)}:${String(chapter.seconds % 60).padStart(2, "0")} ${chapter.title}${chapter.market ? ` | ${chapter.market}` : ""}`).join("\n");
}

/** Read malformed historical data defensively without rewriting it or publishing AI drafts. */
export function readableMarketChapters(value: unknown, duration?: number | null): MarketInsightChapter[] {
  if (!Array.isArray(value)) return [];
  let previous = -1;
  return value.filter((chapter) => {
    if (validateMarketChapters([chapter], duration) || chapter.seconds <= previous) return false;
    previous = chapter.seconds;
    return true;
  });
}
