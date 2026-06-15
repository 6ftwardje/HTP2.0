type PerfMetaValue = string | number | boolean | null | undefined;

function formatMeta(meta?: Record<string, PerfMetaValue>) {
  if (!meta) return "";

  const parts = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function logDuration(
  label: string,
  startedAt: number,
  meta?: Record<string, PerfMetaValue>
) {
  const durationMs = Date.now() - startedAt;
  console.info(`[perf] ${label} duration_ms=${durationMs}${formatMeta(meta)}`);
}

export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  meta?: Record<string, PerfMetaValue>
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    logDuration(label, startedAt, meta);
  }
}
