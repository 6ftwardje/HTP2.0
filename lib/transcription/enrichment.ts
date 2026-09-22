export const TRANSCRIPT_ENRICHMENT_PROMPT_VERSION = "market-insight-v1";

export type EnrichmentChapter = { title: string; seconds: number };
export type TranscriptEnrichment = {
  summary: string;
  keyTakeaways: string[];
  chapters: EnrichmentChapter[];
};

export type EnrichmentValidation =
  | { ok: true; value: TranscriptEnrichment }
  | { ok: false; reason: string };

const MAX_SUMMARY_LENGTH = 600;
const MAX_TAKEAWAYS = 5;
const MAX_TAKEAWAY_LENGTH = 240;
const MAX_CHAPTERS = 12;

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

export function validateTranscriptEnrichment(
  input: unknown,
  durationSeconds: number
): EnrichmentValidation {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { ok: false, reason: "De videoduur is ongeldig." };
  }
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "De enrichmentoutput is geen object." };
  }
  const value = input as Record<string, unknown>;
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  const keyTakeaways = stringList(value.keyTakeaways);
  const chapters = Array.isArray(value.chapters) ? value.chapters : null;

  if (!summary || summary.length > MAX_SUMMARY_LENGTH) {
    return { ok: false, reason: "De samenvatting ontbreekt of is te lang." };
  }
  if (
    !keyTakeaways ||
    keyTakeaways.length > MAX_TAKEAWAYS ||
    keyTakeaways.some((item) => item.length > MAX_TAKEAWAY_LENGTH)
  ) {
    return { ok: false, reason: "De aandachtspunten zijn ongeldig." };
  }
  if (!chapters || chapters.length > MAX_CHAPTERS) {
    return { ok: false, reason: "De hoofdstukken zijn ongeldig." };
  }

  let previousSeconds = -1;
  const normalizedChapters: EnrichmentChapter[] = [];
  for (const item of chapters) {
    const chapter = item as Record<string, unknown>;
    const title = typeof chapter?.title === "string" ? chapter.title.trim() : "";
    const seconds = chapter?.seconds;
    if (
      !title ||
      title.length > 120 ||
      typeof seconds !== "number" ||
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds >= durationSeconds ||
      seconds <= previousSeconds
    ) {
      return {
        ok: false,
        reason: "Hoofdstukken moeten unieke, oplopende tijden binnen de video hebben.",
      };
    }
    normalizedChapters.push({ title, seconds });
    previousSeconds = seconds;
  }

  return {
    ok: true,
    value: { summary, keyTakeaways, chapters: normalizedChapters },
  };
}

export const TRANSCRIPT_ENRICHMENT_INSTRUCTION = `Maak uitsluitend op basis van het aangeleverde Nederlandse transcript een korte samenvatting, maximaal vijf aandachtspunten en maximaal twaalf hoofdstukken. Voeg geen marktfeiten, cijfers, prijsniveaus, voorspellingen of advies toe die niet letterlijk door het transcript worden ondersteund. Presenteer uitspraken uit het transcript als besproken scenario's, niet als vaststaande toekomstige uitkomsten. Als het transcript leeg, tegenstrijdig of onvoldoende verstaanbaar is, retourneer dan geen inhoud maar markeer de output voor menselijke review. Hoofdstuktijden zijn gehele seconden, strikt oplopend en vallen binnen de videoduur. Outputcontract: { summary: string, keyTakeaways: string[], chapters: { title: string, seconds: number }[] }.`;
