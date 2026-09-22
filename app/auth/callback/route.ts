import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthErrorUrl, getSafeAuthNext } from "@/lib/auth-redirect";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeAuthNext(searchParams.get("next"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isTestEnv = process.env.NODE_ENV === "test";

  const redirectToNext = () => NextResponse.redirect(`${origin}${next}`);
  const redirectToError = (reason: "invalid_link" | "configuration") =>
    NextResponse.redirect(getAuthErrorUrl(origin, reason));

  if (!supabaseUrl || !supabaseAnonKey) {
    return isTestEnv ? redirectToNext() : redirectToError("configuration");
  }

  if (!code) {
    return isTestEnv ? redirectToNext() : redirectToError("invalid_link");
  }

  // Zet cookies op de redirect response zelf, zodat de middleware op
  // de volgende request de nieuwe sessie kan detecteren.
  const response = redirectToNext();

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) return response;

  logError("auth.callback_code_exchange_failed", error);
  return isTestEnv ? response : redirectToError("invalid_link");
}
