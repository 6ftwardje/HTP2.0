import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthErrorUrl, getSafeAuthNext, type AuthErrorReason } from "@/lib/auth-redirect";
import { AUTH_LINK_HEADERS, getConfirmationNext, getEmailOtpType } from "@/lib/auth-confirmation";
import { logError } from "@/lib/logger";

const COMPLETED_LINK_COOKIE = "htp_completed_auth_link";

function redirect(url: URL | string) {
  return NextResponse.redirect(url, { status: 303, headers: AUTH_LINK_HEADERS });
}

// Mail scanners and browser prefetches may follow every GET redirect.
// Neither GET nor HEAD may verify or consume a one-time authentication token.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const type = getEmailOtpType(searchParams.get("type"));
  const tokenHash = searchParams.get("token_hash");
  const next = getSafeAuthNext(searchParams.get("next"));
  if (!tokenHash || !type) return redirect(getAuthErrorUrl(origin, "invalid_link", type, next));

  const destination = new URL("/auth/verify", origin);
  destination.search = new URLSearchParams({ token_hash: tokenHash, type, next }).toString();
  return redirect(destination);
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  // Referrer-Policy: no-referrer makes native form POSTs send Origin: null.
  // Browser-controlled Fetch Metadata still identifies an actual same-origin
  // navigation. Cross-site/same-site forms must never use this fallback.
  const formOrigin = request.headers.get("origin");
  const sameOriginForm = (formOrigin === null || formOrigin === "null" || formOrigin === "") &&
    request.headers.get("sec-fetch-site") === "same-origin";
  if (formOrigin !== origin && !sameOriginForm) {
    return new NextResponse("Open de link uit je e-mail opnieuw en bevestig op deze website.", {
      status: 403, headers: AUTH_LINK_HEADERS,
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(getAuthErrorUrl(origin, "invalid_link"));
  }
  const type = getEmailOtpType(form.get("type"));
  const tokenHash = form.get("token_hash");
  const requestedNext = form.get("next");
  const safeNext = getSafeAuthNext(typeof requestedNext === "string" ? requestedNext : null);
  const fail = (reason: AuthErrorReason) => redirect(getAuthErrorUrl(origin, reason, type, safeNext));
  if (typeof tokenHash !== "string" || !tokenHash || !type) return fail("invalid_link");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return fail("configuration");

  const intendedNext = getConfirmationNext(type, safeNext);
  const response = redirect(new URL(intendedNext, origin));
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const fingerprint = (userId: string) => createHash("sha256").update(`${type}:${tokenHash}:${userId}`).digest("hex");

  try {
    // Only a previously verified link bound to this authenticated account may
    // resume without consuming the token again. A session alone is not enough.
    const completedLink = request.cookies.get(COMPLETED_LINK_COOKIE)?.value;
    if (completedLink) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && completedLink === fingerprint(user.id)) {
        return response;
      }
    }

    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      logError("auth.confirm_token_failed", { message: "Email token verification failed", code: error.code }, { type, status: error.status });
      if (error.status === 429) return fail("rate_limited");
      return fail(!error.status || error.status >= 500 ? "service_unavailable" : "invalid_link");
    }
    // With secure email change the first of two confirmations succeeds without
    // issuing a session. Do not misreport that accepted link as expired.
    if (type === "email_change" && !data.session) return redirect(new URL("/auth/email-change-pending", origin));
    if (!data.session || !data.user) return fail("invalid_link");

    response.cookies.set(COMPLETED_LINK_COOKIE, fingerprint(data.user.id), {
      httpOnly: true, sameSite: "lax", secure: new URL(origin).protocol === "https:", path: "/auth", maxAge: 3600,
    });
    return response;
  } catch {
    logError("auth.confirm_service_unavailable", { message: "Email verification service could not be reached" }, { type });
    return fail("service_unavailable");
  }
}
