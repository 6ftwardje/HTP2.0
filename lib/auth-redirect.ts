export function getSafeAuthNext(
  value: string | null,
  fallback = "/dashboard"
) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    return fallback;
  }

  return value;
}

export function getAuthErrorUrl(
  origin: string,
  reason: "invalid_link" | "recovery_session_missing" | "configuration"
) {
  const url = new URL("/auth/error", origin);
  url.searchParams.set("reason", reason);
  return url;
}
