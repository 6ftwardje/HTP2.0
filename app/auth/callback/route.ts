import { getAuthOrigin } from "@/lib/auth-origin";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthErrorUrl, getSafeAuthNext, type AuthErrorReason } from "@/lib/auth-redirect";
import { logError } from "@/lib/logger";
import { AUTH_LINK_HEADERS, getConfirmationNext, getEmailOtpType } from "@/lib/auth-confirmation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getAuthOrigin(request.url);
  const code = searchParams.get("code");
  const type = getEmailOtpType(searchParams.get("type"));
  const safeNext = getSafeAuthNext(searchParams.get("next"));
  const intendedNext = type ? getConfirmationNext(type, safeNext) : safeNext;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const redirectToError = (reason: AuthErrorReason) =>
    NextResponse.redirect(getAuthErrorUrl(origin, reason, type, safeNext), { headers: AUTH_LINK_HEADERS });

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectToError("configuration");
  }

  if (!code) {
    return redirectToError("invalid_link");
  }

  // Zet cookies op de redirect response zelf, zodat de middleware op
  // de volgende request de nieuwe sessie kan detecteren.
  const response = NextResponse.redirect(`${origin}${intendedNext}`, { headers: AUTH_LINK_HEADERS });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    // Older reset mails return only ?code=... . Supabase retains the recovery
    // intent alongside the PKCE verifier and returns it after the exchange.
    if ("redirectType" in data && data.redirectType === "PASSWORD_RECOVERY") {
      response.headers.set("Location", `${origin}/account/update-password`);
    }
    return response;
  }

  logError("auth.callback_code_exchange_failed", { message: "Code exchange failed", code: error.code }, { type, status: error.status });
  if (error.status === 429) return redirectToError("rate_limited");
  return redirectToError(!error.status || error.status >= 500 ? "service_unavailable" : "invalid_link");
}
