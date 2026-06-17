const WEEKLY_TIME_COMMITMENT_LABELS: Record<string, string> = {
  "0_2": "0-2 uur",
  "3_5": "3-5 uur",
  "6_10": "6-10 uur",
  "10_plus": "10+ uur",
};

function prettifyLegacyValue(value: string) {
  const normalized = value
    .trim()
    .replace(/(\d+)_plus\b/gi, "$1+")
    .replace(/(\d+)_(\d+)/g, "$1-$2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) return "";

  return normalized.replace(/\p{L}[\p{L}'-]*/gu, (word) => {
    const lower = word.toLocaleLowerCase("nl-BE");
    return lower.charAt(0).toLocaleUpperCase("nl-BE") + lower.slice(1);
  });
}

export function normalizeConfidenceScore(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

export function formatConfidenceScore(
  value: unknown,
  emptyLabel = "Nog niet ingevuld"
) {
  const score = normalizeConfidenceScore(value);
  return score === null ? emptyLabel : `${score}/5`;
}

export function formatIntakeChoice(
  value: string | number | null | undefined,
  emptyLabel = "Nog niet ingevuld"
) {
  if (value === null || value === undefined || value === "") return emptyLabel;

  const formatted = prettifyLegacyValue(String(value));
  return formatted || emptyLabel;
}

export function formatWeeklyTimeCommitment(
  value: string | null | undefined,
  emptyLabel = "Nog niet ingevuld"
) {
  if (!value) return emptyLabel;
  return WEEKLY_TIME_COMMITMENT_LABELS[value] ?? formatIntakeChoice(value, emptyLabel);
}
