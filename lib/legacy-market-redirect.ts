export type LegacyMarketSearchParams = Record<string, string | string[] | undefined>;

/** Preserve old filter/timestamp parameters while keeping the destination fixed. */
export function withLegacyMarketQuery(path: string, params: LegacyMarketSearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  return path + (query.size ? "?" + query.toString() : "");
}
