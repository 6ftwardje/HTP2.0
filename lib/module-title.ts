export function stripModulePrefix(
  title: string,
  orderIndex?: number | null
) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return trimmedTitle;

  const prefixPattern =
    typeof orderIndex === "number"
      ? new RegExp(`^module\\s*${orderIndex}\\s*:\\s*`, "i")
      : /^module\s+\d+\s*:\s*/i;

  const strippedTitle = trimmedTitle.replace(prefixPattern, "").trim();
  return strippedTitle || trimmedTitle;
}

export function formatModuleTitle(orderIndex: number, title: string) {
  return `Module ${orderIndex}: ${stripModulePrefix(title, orderIndex)}`;
}

export function formatModuleOptionLabel(orderIndex: number, title: string) {
  return `${orderIndex}. ${stripModulePrefix(title, orderIndex)}`;
}
