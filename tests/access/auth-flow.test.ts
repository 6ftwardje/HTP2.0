import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as openLink, POST as confirm } from "../../app/auth/confirm/route";
import { GET as callback } from "../../app/auth/callback/route";
import { updateSession } from "../../lib/supabase/middleware";

const ORIGIN = "http://localhost:3100";
const AUTH_ORIGIN = "https://auth.example.invalid";
const USER_ID = "00000000-0000-0000-0000-000000000001";

async function withAuthService<T>(run: () => Promise<T>, configured = true) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  Object.assign(process.env, { NODE_ENV: "production" });
  if (configured) Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: AUTH_ORIGIN,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-key",
  });
  else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  try { return await run(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function submit(values: Record<string, string> = {}, cookie = "", origin = ORIGIN) {
  return new NextRequest(`${ORIGIN}/auth/confirm`, {
    method: "POST", headers: { origin, cookie },
    body: new URLSearchParams({ type: "signup", token_hash: "local-token", next: "/dashboard", ...values }),
  });
}

function session() {
  const payload = Buffer.from(JSON.stringify({ sub: USER_ID, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.local-test-signature`,
    token_type: "bearer", expires_in: 3600, refresh_token: "local-refresh-token",
    user: { id: USER_ID, aud: "authenticated", email: "local-test@example.invalid" },
  };
}

function location(response: Response) { return new URL(response.headers.get("location")!); }

test("mail scanners and HEAD/prefetch requests never consume tokens or create sessions", async (context) => {
  context.mock.method(globalThis, "fetch", async () => { assert.fail("opening a link must not contact Auth"); });
  for (const type of ["signup", "email", "recovery", "invite", "magiclink", "email_change"]) {
    for (const method of ["GET", "HEAD"]) {
      const response = await openLink(new NextRequest(`${ORIGIN}/auth/confirm?token_hash=scanner-token&type=${type}&next=%2Fmodules%3Flesson%3Dintro`, { method }));
      assert.equal(location(response).pathname, "/auth/verify");
      assert.equal(location(response).searchParams.get("token_hash"), "scanner-token");
      assert.equal(location(response).searchParams.get("type"), type);
      assert.equal(location(response).searchParams.get("next"), "/modules?lesson=intro");
      assert.equal(response.cookies.getAll().length, 0);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    }
  }
});

test("invalid and malformed links fail closed without contacting Auth", async (context) => {
  context.mock.method(globalThis, "fetch", async () => { assert.fail("invalid input must not contact Auth"); });
  for (const query of ["", "token_hash=token", "type=signup", "type=admin&token_hash=token"]) {
    const response = await openLink(new NextRequest(`${ORIGIN}/auth/confirm?${query}`));
    assert.equal(location(response).pathname, "/auth/error");
  }
  await withAuthService(async () => {
    for (const values of [{ token_hash: "" }, { type: "admin" }] as Record<string, string>[]) {
      const response = await confirm(submit(values));
      assert.equal(location(response).searchParams.get("reason"), "invalid_link");
      assert.equal(response.cookies.getAll().length, 0);
    }
  });
});

test("signup verifies only after an explicit POST and writes cookies before opening the dashboard", async (context) => {
  await withAuthService(async () => {
    let authRequests = 0;
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      authRequests++;
      assert.equal(String(input), `${AUTH_ORIGIN}/auth/v1/verify`);
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), { token_hash: "local-token", type: "signup", gotrue_meta_security: {} });
      return Response.json(session());
    });
    const response = await confirm(submit());
    assert.equal(authRequests, 1);
    assert.equal(response.status, 303, "redirect must turn the form POST into a GET");
    assert.equal(location(response).href, `${ORIGIN}/dashboard`);
    assert.ok(response.cookies.getAll().some(cookie => cookie.name.startsWith("sb-") && cookie.value));
    assert.equal(response.cookies.get("htp_completed_auth_link")?.httpOnly, true);
  });
});

test("confirmation works on another device without PKCE cookies and preserves a safe explicit next", async (context) => {
  await withAuthService(async () => {
    context.mock.method(globalThis, "fetch", async () => Response.json(session()));
    const response = await confirm(submit({ next: "/modules?lesson=intro" }, ""));
    assert.equal(location(response).href, `${ORIGIN}/modules?lesson=intro`);
    assert.ok(response.cookies.getAll().some(cookie => cookie.name.startsWith("sb-") && cookie.value));
    const unsafe = await confirm(submit({ next: "//attacker.invalid" }, ""));
    assert.equal(location(unsafe).href, `${ORIGIN}/dashboard`);
  });
});

test("invitations select a password and recovery cannot be redirected into an offer", async (context) => {
  await withAuthService(async () => {
    context.mock.method(globalThis, "fetch", async () => Response.json(session()));
    for (const [type, expected] of [["invite", "/account/update-password?mode=invite"], ["recovery", "/account/update-password"]]) {
      const response = await confirm(submit({ type }));
      assert.equal(location(response).href, `${ORIGIN}${expected}`);
      assert.equal(response.cookies.get("htp_offer_preview"), undefined);
    }
  });
});

test("secure email changes acknowledge the first mailbox without inventing a session", async (context) => {
  await withAuthService(async () => {
    context.mock.method(globalThis, "fetch", async () => Response.json({ message: "Confirmation accepted" }));
    const response = await confirm(submit({ type: "email_change", next: "/account" }));
    assert.equal(location(response).pathname, "/auth/email-change-pending");
    assert.equal(response.cookies.getAll().length, 0);
  });
});

test("expired signup links keep their confirmation recovery context and never expose tokens", async (context) => {
  await withAuthService(async () => {
    context.mock.method(globalThis, "fetch", async () => Response.json({ code: "otp_expired", message: "Token expired" }, { status: 403 }));
    const response = await confirm(submit());
    assert.equal(location(response).pathname, "/auth/error");
    assert.equal(location(response).searchParams.get("flow"), "signup");
    assert.equal(location(response).searchParams.get("reason"), "invalid_link");
    assert.ok(!location(response).href.includes("local-token"));
    assert.equal(response.cookies.getAll().length, 0);
  });
});

test("temporary outages and throttling do not claim that a valid link expired", async (context) => {
  await withAuthService(async () => {
    for (const [status, reason] of [[429, "rate_limited"], [503, "service_unavailable"]] as const) {
      const mocked = context.mock.method(globalThis, "fetch", async () => Response.json({ code: "test_failure", message: "Test failure" }, { status }));
      const response = await confirm(submit());
      assert.equal(location(response).searchParams.get("reason"), reason);
      assert.equal(response.cookies.getAll().length, 0);
      mocked.mock.restore();
    }
  });
});

test("untrusted or missing form origins are rejected before consuming a token", async (context) => {
  context.mock.method(globalThis, "fetch", async () => { assert.fail("untrusted forms must not contact Auth"); });
  for (const origin of ["https://attacker.invalid", "null", ""]) {
    assert.equal((await confirm(submit({}, "", origin))).status, 403);
  }
});

test("native no-referrer form posts use same-origin Fetch Metadata when Origin is null", async (context) => {
  await withAuthService(async () => {
    context.mock.method(globalThis, "fetch", async () => Response.json(session()));
    for (const origin of ["null", ""]) {
      const request = submit({}, "", origin);
      request.headers.set("sec-fetch-site", "same-origin");
      const response = await confirm(request);
      assert.equal(location(response).pathname, "/dashboard");
      assert.ok(response.cookies.getAll().some(cookie => cookie.name.startsWith("sb-") && cookie.value));
    }
  });
});

test("Fetch Metadata never authorizes cross-site forms or an explicit foreign Origin", async (context) => {
  context.mock.method(globalThis, "fetch", async () => { assert.fail("untrusted forms must not contact Auth"); });
  for (const site of ["cross-site", "same-site", "none"]) {
    const request = submit({}, "", "null");
    request.headers.set("sec-fetch-site", site);
    assert.equal((await confirm(request)).status, 403);
  }
  const forged = submit({}, "", "https://attacker.invalid");
  forged.headers.set("sec-fetch-site", "same-origin");
  assert.equal((await confirm(forged)).status, 403);
});

test("reopening a completed link resumes only the same authenticated account", async (context) => {
  await withAuthService(async () => {
    let verificationRequests = 0;
    let currentUser = session().user;
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/user")) return Response.json(currentUser);
      verificationRequests++;
      if (verificationRequests > 1) return Response.json({ code: "otp_expired", message: "Token expired" }, { status: 403 });
      return Response.json(session());
    });
    const first = await confirm(submit({}, ""));
    const cookie = first.cookies.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
    const repeat = await confirm(submit({}, cookie));
    assert.equal(location(repeat).pathname, "/dashboard");
    assert.equal(verificationRequests, 1, "do not consume the same verified token twice");
    currentUser = { ...currentUser, id: "another-account" };
    const wrongUser = await confirm(submit({}, cookie));
    assert.equal(location(wrongUser).pathname, "/auth/error");
    assert.equal(verificationRequests, 2, "a different account cannot reuse the completion marker");
  });
});

test("missing configuration never simulates a successful authentication", () => withAuthService(async () => {
  Object.assign(process.env, { NODE_ENV: "test" });
  for (const response of [await confirm(submit()), await callback(new NextRequest(`${ORIGIN}/auth/callback?code=test`))]) {
    assert.equal(location(response).searchParams.get("reason"), "configuration");
    assert.equal(response.cookies.getAll().length, 0);
  }
}, false));

test("auth routes bypass middleware session refresh even with stale cookies", async (context) => {
  context.mock.method(globalThis, "fetch", async () => { assert.fail("auth handler owns session refresh"); });
  const response = await updateSession(new NextRequest(`${ORIGIN}/auth/verify?token_hash=test&type=signup`, { headers: { cookie: "sb-auth-auth-token=stale" } }));
  assert.equal(response.headers.get("location"), null);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("protected routes retain the existing production login entry point", () => withAuthService(async () => {
  const response = await updateSession(new NextRequest(`${ORIGIN}/modules?lesson=intro`));
  assert.equal(location(response).pathname, "/");
  assert.equal(location(response).searchParams.get("redirectedFrom"), "/modules");
  assert.equal((await updateSession(new NextRequest(`${ORIGIN}/`))).headers.get("location"), null);
}, false));


test("Netlify runtime aliases keep confirmation and session redirects on the public domain", async (context) => {
  await withAuthService(async () => {
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const canonical = "https://platform.example.test";
    const internal = "https://main--sample.netlify.app";
    process.env.NEXT_PUBLIC_SITE_URL = canonical;
    context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) =>
      Response.json(String(input).endsWith("/user") ? session().user : session())
    );
    try {
      const opened = await openLink(new NextRequest(`${internal}/auth/confirm?type=signup&token_hash=local-token`));
      assert.equal(location(opened).origin, canonical);
      const confirmed = await confirm(new NextRequest(`${internal}/auth/confirm`, {
        method: "POST", headers: { origin: canonical },
        body: new URLSearchParams({ type: "signup", token_hash: "local-token" }),
      }));
      assert.equal(location(confirmed).href, `${canonical}/dashboard`);
      const cookie = confirmed.cookies.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
      const resumed = await updateSession(new NextRequest(`${internal}/`, { headers: { cookie } }));
      assert.equal(location(resumed).href, `${canonical}/dashboard`);
      const guest = await updateSession(new NextRequest(`${internal}/modules`));
      assert.equal(location(guest).origin, canonical);
    } finally {
      if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    }
  });
});
