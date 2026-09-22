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
const MIN_SPOKEN_CHARACTERS = 120;
const MAX_UNCLEAR_RATIO = 0.25;

export type TranscriptQuality =
  | { usable: true; spokenCharacters: number; unclearRatio: number }
  | { usable: false; reason: "empty" | "too_short" | "too_unclear" };

export type EnrichmentSourceSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export function assessTranscriptQuality(
  segments: EnrichmentSourceSegment[]
): TranscriptQuality {
  const text = segments.map((segment) => segment.text.trim()).filter(Boolean).join(" ");
  if (!text) return { usable: false, reason: "empty" };
  const spokenCharacters = text.replace(/\s/g, "").length;
  if (spokenCharacters < MIN_SPOKEN_CHARACTERS) {
    return { usable: false, reason: "too_short" };
  }
  const unclearMatches = text.match(/\[(?:onverstaanbaar|stilte|inaudible|silence)\]/gi) ?? [];
  const unclearCharacters = unclearMatches.reduce((total, match) => total + match.length, 0);
  const unclearRatio = unclearCharacters / Math.max(text.length, 1);
  if (unclearRatio > MAX_UNCLEAR_RATIO) {
    return { usable: false, reason: "too_unclear" };
  }
  return { usable: true, spokenCharacters, unclearRatio };
}

function numericClaims(text: string): Set<string> {
  return new Set(text.match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?%?/gu) ?? []);
}

export function validateNumericGrounding(
  enrichment: TranscriptEnrichment,
  transcriptText: string
): { ok: true } | { ok: false; novelClaims: string[] } {
  const sourceClaims = numericClaims(transcriptText);
  const output = [
    enrichment.summary,
    ...enrichment.keyTakeaways,
    ...enrichment.chapters.map((chapter) => chapter.title),
  ].join(" ");
  const novelClaims = [...numericClaims(output)].filter((claim) => !sourceClaims.has(claim));
  return novelClaims.length ? { ok: false, novelClaims } : { ok: true };
}

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

export const TRANSCRIPT_ENRICHMENT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", maxLength: MAX_SUMMARY_LENGTH },
    keyTakeaways: {
      type: "array",
      maxItems: MAX_TAKEAWAYS,
      items: { type: "string", maxLength: MAX_TAKEAWAY_LENGTH },
    },
    chapters: {
      type: "array",
      maxItems: MAX_CHAPTERS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", maxLength: 120 },
          seconds: { type: "integer", minimum: 0 },
        },
        required: ["title", "seconds"],
      },
    },
  },
  required: ["summary", "keyTakeaways", "chapters"],
} as const;

export const TRANSCRIPT_ENRICHMENT_INSTRUCTION = `Contractversie: ${TRANSCRIPT_ENRICHMENT_PROMPT_VERSION}. Maak uitsluitend op basis van het aangeleverde Nederlandse transcript een korte samenvatting, maximaal vijf aandachtspunten en maximaal twaalf hoofdstukken. Voeg geen marktfeiten, cijfers, prijsniveaus, voorspellingen of advies toe die niet letterlijk door het transcript worden ondersteund. Los tegenstrijdige cijfers niet zelf op: benoem neutraal dat het transcript verschillende waarden noemt en laat de admin dit controleren. Presenteer uitspraken uit het transcript als besproken scenario's, niet als vaststaande toekomstige uitkomsten. Een leeg, te kort of grotendeels onverstaanbaar transcript wordt vóór de modelcall geblokkeerd voor menselijke review. Hoofdstuktijden zijn gehele seconden, strikt oplopend en vallen binnen de videoduur.`;
