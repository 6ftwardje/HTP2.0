type LogContext = Record<string, unknown>;

function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...Object.fromEntries(["code", "details", "hint"].filter((key) => key in error).map((key) => [key, (error as unknown as Record<string, unknown>)[key]])),
      ...("digest" in error ? { digest: error.digest } : {}),
      ...(error.cause && depth < 4 ? { cause: serializeError(error.cause, depth + 1) } : {}),
    };
  }

  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      message: typeof value.message === "string" ? value.message : "Unknown error",
      code: value.code,
      details: value.details,
      hint: value.hint,
    };
  }

  return { message: String(error) };
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
  console.error(
    "[htp] " + JSON.stringify({
      level: "error",
      event,
      timestamp: new Date().toISOString(),
      ...context,
      error: serializeError(error),
    })
  );
}
