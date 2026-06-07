/**
 * Coerce DB / JSON values to plain text for React children.
 * Avoids "Objects are not valid as a React child" when a column stores JSON/objects.
 */
export function asText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}
