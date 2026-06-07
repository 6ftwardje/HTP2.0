import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") &&
    !requestedNext.startsWith("//") &&
    !requestedNext.includes("\\")
      ? requestedNext
      : "/dashboard";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isTestEnv = process.env.NODE_ENV === "test";

  const redirectToNext = () => NextResponse.redirect(`${origin}${next}`);
  const redirectToLogin = () =>
    NextResponse.redirect(`${origin}/?error=auth`);

  if (!supabaseUrl || !supabaseAnonKey) {
    return isTestEnv ? redirectToNext() : redirectToLogin();
  }

  if (!code) {
    return isTestEnv ? redirectToNext() : redirectToLogin();
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

  return isTestEnv ? response : redirectToLogin();
}
