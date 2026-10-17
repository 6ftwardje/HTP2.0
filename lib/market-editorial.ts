/** Presentation policy only: short context stays visible as labels, never rewritten. */
export function marketPlainText(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

/** A conservative editorial convention, not a grammatical/AI judgement. */
export function hasEditorialSentence(value: string): boolean {
  return value.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length >= 4
    && /[.!?][”’"')\]]?$/.test(value)
    && !/\b(?:bv|bijv|o\.a|d\.w\.z|etc)\.$/i.test(value);
}

export function editorialContext(summary: string | null | undefined, event: string | null | undefined) {
  const labels: string[] = [];
  const section = (input: string | null | undefined) => {
    const value = marketPlainText(input);
    if (!value) return null;
    if (hasEditorialSentence(value)) return value;
    if (!labels.includes(value)) labels.push(value);
    return null;
  };
  return { summary: section(summary), event: section(event), labels };
}

/** Strip only a short list prefix followed by whitespace, never decimals, years or amounts. */
export function cleanTakeaway(value: string) {
  return value.trim().replace(/^\d{1,3}[.)]\s+/, "");
}

export function parseTakeaways(value: unknown): string[] {
  return typeof value === "string" ? value.split(/\r?\n/).map(cleanTakeaway).filter(Boolean) : [];
}
