import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NextRequest, type NextResponse } from "next/server";
import { POST as confirm } from "../../app/auth/confirm/route";
import { GET as callback } from "../../app/auth/callback/route";

const APP_ORIGIN = "http://localhost:3100";
const AUTH_ORIGIN = "https://recovery.example.invalid";
const SESSION_COOKIE = "sb-recovery-auth-token";

test("both recovery email links go directly to app verification regardless of the request callback", () => {
  const template = readFileSync(new URL("../../docs/auth-email-templates/reset-password.html", import.meta.url), "utf8");
  for (const redirectTo of ["", "https://hettradeplatform.be", "https://hettradeplatform.be/auth/callback?type=recovery&next=/account/update-password"]) {
    const rendered = template
      .replaceAll("{{ .SiteURL }}", "https://hettradeplatform.be")
      .replaceAll("{{ .RedirectTo }}", redirectTo)
      .replaceAll("{{ .TokenHash }}", "test-recovery-token");
    const links = [...rendered.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"));
    assert.equal(links.length, 2, "button and copyable link are both present");
    for (const link of links) {
      const destination = new URL(link);
      assert.equal(destination.origin, "https://hettradeplatform.be");
      assert.equal(destination.pathname, "/auth/confirm");
      assert.equal(destination.searchParams.get("type"), "recovery");
      assert.equal(destination.searchParams.get("token_hash"), "test-recovery-token");
      assert.equal(destination.searchParams.get("next"), "/account/update-password");
    }
  }
});

async function withAuthService<T>(run: () => Promise<T>) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  Object.assign(process.env, {
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: AUTH_ORIGIN,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-recovery-test-key",
  });
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function request(path: string, verifier?: string) {
  const cookies = ["htp_offer_preview=academy"];
  if (verifier) {
    const encoded = Buffer.from(JSON.stringify(verifier)).toString("base64url");
    cookies.push(`${SESSION_COOKIE}-code-verifier=base64-${encoded}`);
  }
  const url = new URL(path, APP_ORIGIN);
  const confirmation = url.pathname === "/auth/confirm";
  return new NextRequest(confirmation ? `${APP_ORIGIN}/auth/confirm` : url, {
    method: confirmation ? "POST" : "GET",
    headers: { cookie: cookies.join("; "), origin: APP_ORIGIN },
    ...(confirmation ? { body: url.searchParams } : {}),
  });
}

function sessionResponse() {
  const payload = Buffer.from(JSON.stringify({
    sub: "00000000-0000-0000-0000-000000000002",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  return Response.json({
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.local-test-signature`,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "local-recovery-refresh-token",
    user: {
      id: "00000000-0000-0000-0000-000000000002",
      aud: "authenticated",
      email: "local-recovery@example.invalid",
    },
  });
}

function assertRecoverySession(response: NextResponse) {
  assert.equal(response.headers.get("location"), `${APP_ORIGIN}/account/update-password`);
  assert.ok(response.cookies.getAll().some((cookie) =>
    (cookie.name === SESSION_COOKIE || cookie.name.startsWith(`${SESSION_COOKIE}.`)) && cookie.value
  ), "the recovery redirect must carry the new session cookie");
  assert.equal(response.cookies.get("htp_offer_preview"), undefined);
}

function assertInvalidLink(response: NextResponse) {
  const destination = new URL(response.headers.get("location")!);
  assert.equal(destination.origin, APP_ORIGIN);
  assert.equal(destination.pathname, "/auth/error");
  assert.equal(destination.searchParams.get("reason"), "invalid_link");
  assert.ok(!response.cookies.getAll().some((cookie) =>
    (cookie.name === SESSION_COOKIE || cookie.name.startsWith(`${SESSION_COOKIE}.`)) && cookie.value
  ), "an invalid link must not establish a session");
}

test("recovery token confirmation sets its session and always opens password selection", async (context) => {
  await withAuthService(async () => {
    let authRequests = 0;
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      authRequests += 1;
      assert.equal(String(input), `${AUTH_ORIGIN}/auth/v1/verify`);
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        token_hash: "local-recovery-token",
        type: "recovery",
        gotrue_meta_security: {},
      });
      return sessionResponse();
    });
    const response = await confirm(request("/auth/confirm?token_hash=local-recovery-token&type=recovery&next=/dashboard"));
    assert.equal(authRequests, 1);
    assertRecoverySession(response);
  });
});

test("an explicit PKCE recovery callback keeps password selection ahead of another next destination", async (context) => {
  await withAuthService(async () => {
    let authRequests = 0;
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      authRequests += 1;
      assert.equal(String(input), `${AUTH_ORIGIN}/auth/v1/token?grant_type=pkce`);
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        auth_code: "local-recovery-code",
        code_verifier: "local-verifier",
      });
      return sessionResponse();
    });
    const response = await callback(request(
      "/auth/callback?code=local-recovery-code&type=recovery&next=/dashboard",
      "local-verifier"
    ));
    assert.equal(authRequests, 1);
    assertRecoverySession(response);
  });
});

test("a legacy PKCE callback recognizes password recovery from the verifier without type or next", async (context) => {
  await withAuthService(async () => {
    let authRequests = 0;
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      authRequests += 1;
      assert.equal(String(input), `${AUTH_ORIGIN}/auth/v1/token?grant_type=pkce`);
      assert.deepEqual(JSON.parse(String(init?.body)), {
        auth_code: "legacy-recovery-code",
        code_verifier: "legacy-verifier",
      });
      return sessionResponse();
    });
    const response = await callback(request(
      "/auth/callback?code=legacy-recovery-code",
      "legacy-verifier/PASSWORD_RECOVERY"
    ));
    assert.equal(authRequests, 1);
    assertRecoverySession(response);
  });
});

test("a failed recovery code exchange opens an invalid-link error without a session", async (context) => {
  await withAuthService(async () => {
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      assert.equal(String(input), `${AUTH_ORIGIN}/auth/v1/token?grant_type=pkce`);
      return Response.json({
        code: "flow_state_not_found",
        message: "Invalid flow state, no valid flow state found",
      }, { status: 400 });
    });
    const response = await callback(request(
      "/auth/callback?code=expired-recovery-code&type=recovery",
      "local-verifier/PASSWORD_RECOVERY"
    ));
    assertInvalidLink(response);
  });
});

test("an expired recovery token opens an invalid-link error without a session", async (context) => {
  await withAuthService(async () => {
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      assert.equal(String(input), `${AUTH_ORIGIN}/auth/v1/verify`);
      return Response.json({
        code: "otp_expired",
        message: "Token has expired or is invalid",
      }, { status: 403 });
    });
    const response = await confirm(request("/auth/confirm?token_hash=expired-recovery-token&type=recovery"));
    assertInvalidLink(response);
  });
});
