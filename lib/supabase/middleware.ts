import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { profileIsComplete, profileCompletionUrl } from "@/lib/profile";
import { logError } from "@/lib/logger";
import { logDuration } from "@/lib/performance";

const SUPABASE_COOKIE_PREFIX = "sb-";
const PROTECTED_PREFIXES = [
  "/profile-completion",
  "/admin",
  "/dashboard",
  "/lessons",
  "/modules",
  "/onboarding",
  "/market-analysis",
  "/updates",
  "/weekly-updates",
  "/mentor",
  "/mentor-inbox",
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
  const requestHeaders = new Headers(request.headers);
  // Always overwrite a caller-provided value; this header only preserves a safe return path.
  requestHeaders.set("x-htp-return-to", request.nextUrl.pathname + request.nextUrl.search);
  let supabaseResponse = NextResponse.next({request:{headers:requestHeaders}});
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

  // API routes which use Auth/RPC directly must not bypass the page/action gate.
  if (user && pathname.startsWith("/api/")) {
    const {data:profile,error} = await supabase.from("students").select("name,phone").eq("auth_user_id",user.id).maybeSingle();
    if(error) {
      logError("profile.api_gate.failed", {code:error.code,message:"Profile gate lookup failed"}, {route:routeLabel(pathname)});
      return NextResponse.json({error:"Profielgegevens konden niet worden gecontroleerd."},{status:503});
    }
    if(!profile || !profileIsComplete(profile)) {
      const response=NextResponse.json({error:"profile_required",completionUrl:profileCompletionUrl(null)},{status:403});
      for(const cookie of supabaseResponse.cookies.getAll())response.cookies.set(cookie);
      return response;
    }
  }

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
