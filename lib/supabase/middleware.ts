import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { logDuration } from "@/lib/performance";

const SUPABASE_COOKIE_PREFIX = "sb-";
const PROTECTED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/lessons",
  "/modules",
  "/onboarding",
  "/market-analysis",
  "/updates",
  "/weekly-updates",
];

function clearSupabaseCookies(response: NextResponse, request: NextRequest) {
  request.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith(SUPABASE_COOKIE_PREFIX))
    .forEach((cookie) => {
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
      });
    });
}

function hasSupabaseAuthCookies(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith(SUPABASE_COOKIE_PREFIX));
}

function isProtectedPath(pathname: string) {
  return (
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) || pathname === "/account"
  );
}

function routeLabel(pathname: string) {
  const prefix = PROTECTED_PREFIXES.find(
    (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`)
  );
  return prefix ?? (pathname === "/" ? "/" : "public");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });
  const pathname = request.nextUrl.pathname;

  // In test environment mogen we niet terugvallen naar `/`.
  // Zo kunnen we de UI/flow testen zonder echte Supabase sessies.
  if (process.env.NODE_ENV === "test") {
    return supabaseResponse;
  }

  const protectedPath = isProtectedPath(pathname);
  const hasAuthCookies = hasSupabaseAuthCookies(request);

  if (!protectedPath && !hasAuthCookies) {
    return supabaseResponse;
  }

  if (protectedPath && !hasAuthCookies) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirectedFrom", pathname);
    const response = NextResponse.redirect(url);
    clearSupabaseCookies(response, request);
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const authStartedAt = Date.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  logDuration("middleware.auth.getUser", authStartedAt, {
    protected: protectedPath,
    route: routeLabel(pathname),
    user: Boolean(user),
  });

  if (pathname === "/" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (protectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirectedFrom", pathname);
    const response = NextResponse.redirect(url);
    clearSupabaseCookies(response, request);
    return response;
  }

  return supabaseResponse;
}
