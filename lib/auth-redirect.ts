export function getSafeAuthNext(
  value: string | null,
  fallback = "/dashboard"
) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  return value;
}

export type AuthErrorReason = "invalid_link" | "recovery_session_missing" | "configuration" | "service_unavailable" | "rate_limited";

export function getAuthErrorUrl(
  origin: string,
  reason: AuthErrorReason,
  flow?: string | null,
  next?: string | null,
) {
  const url = new URL("/auth/error", origin);
  url.searchParams.set("reason", reason);
  if (flow) url.searchParams.set("flow", flow);
  if (next) url.searchParams.set("next", getSafeAuthNext(next));
  return url;
}
