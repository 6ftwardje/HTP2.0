import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { assertStagingSupabaseTarget, assertStagingBuildEnvironment, stagingAdminHeaders } from "../../scripts/lib/staging-target.mjs";

const ref = "abcdefghijklmnopqrst";
const otherRef = "zyxwvutsrqponmlkjihg";
const url = `https://${ref}.supabase.co`;
const target = JSON.parse(readFileSync(new URL("../../netlify/staging-target.json", import.meta.url), "utf8"));
const verifier = new URL("../../scripts/verify-supabase-target.mjs", import.meta.url).href;
const token = (claims) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.test`;

function runVerifier(env, { mockResponses = false, cwd } = {}) {
  const mock = mockResponses ? `
    globalThis.fetch = async (input, options) => {
      if (!String(input).startsWith(${JSON.stringify(url + "/rest/v1/")})) throw new Error("Wrong request origin");
      if (options.headers.Authorization) throw new Error("Opaque key sent as JWT");
      if (options.method && options.method !== "GET") throw new Error("Unexpected write");
      if (options.redirect !== "error") throw new Error("Requests must not follow redirects");
      const pathname = new URL(input).pathname;
      if (pathname === "/rest/v1/") return Response.json({ definitions: {
        modules: { properties: { order_index: {} } },
        lessons: { properties: { order_index: {} } }
      }});
      return Response.json([], { headers: { "content-range": "*/0" }});
    };
  ` : `globalThis.fetch = async () => { console.log("UNEXPECTED_NETWORK_REQUEST"); throw new Error("Unexpected request"); };`;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", `${mock}\nawait import(${JSON.stringify(verifier)});`], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, ...env }, timeout: 10000,
  });
}

test("both production projects fail before the verifier can send any request", () => {
  for (const productionRef of ["swohtycdqbydqrtjzwwf", "trogwrgxxhsvixzglzpn"]) {
    const result = runVerifier({
      NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
      HTP_STAGING_SUPABASE_PROJECT_REF: productionRef,
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic_only",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing protected/);
    assert.doesNotMatch(result.stdout, /UNEXPECTED_NETWORK_REQUEST/);
    assert.doesNotMatch(result.stderr, /sb_secret_synthetic_only/);
  }
});

test("unknown projects require an explicit matching staging ref before any request", () => {
  for (const expected of [undefined, otherRef]) {
    const result = runVerifier({
      NEXT_PUBLIC_SUPABASE_URL: url,
      ...(expected ? { HTP_STAGING_SUPABASE_PROJECT_REF: expected } : {}),
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic_only",
    });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /UNEXPECTED_NETWORK_REQUEST/);
  }
});

test("the verifier never falls back to credentials from .env.local", () => {
  const directory = mkdtempSync(join(tmpdir(), "htp-staging-env-test-"));
  try {
    writeFileSync(join(directory, ".env.local"), `NEXT_PUBLIC_SUPABASE_URL=${url}\nHTP_STAGING_SUPABASE_PROJECT_REF=${ref}\nSUPABASE_SERVICE_ROLE_KEY=sb_secret_synthetic_only\n`);
    const result = runVerifier({}, { cwd: directory });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Set NEXT_PUBLIC_SUPABASE_URL/);
    assert.doesNotMatch(result.stdout, /UNEXPECTED_NETWORK_REQUEST/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("valid staging still performs the read-only schema and integrity audit", () => {
  const result = runVerifier({
    NEXT_PUBLIC_SUPABASE_URL: `${url}/`,
    HTP_STAGING_SUPABASE_PROJECT_REF: ref,
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic_only",
  }, { mockResponses: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /explicitly verified staging target/);
  assert.match(result.stdout, /duplicate progress student\/lesson: none/);
});

test("only the exact HTTPS Supabase origin is accepted", () => {
  for (const invalid of ["", "not a URL", `http://${ref}.supabase.co`, `${url}:444`, `${url}/rest/v1/`, `${url}?key=test`, `${url}#test`, `${url}.example.org`, `https://name:password@${ref}.supabase.co`, "http://localhost:54321"]) {
    assert.throws(() => assertStagingSupabaseTarget({ url: invalid, expectedProjectRef: ref }));
  }
  assert.deepEqual(assertStagingSupabaseTarget({ url: `${url}/`, expectedProjectRef: ref }), { projectRef: ref, url });
});

test("new secret keys use apikey; legacy keys must identify the selected staging project", () => {
  assert.deepEqual(stagingAdminHeaders("sb_secret_synthetic_only", ref), { apikey: "sb_secret_synthetic_only" });
  const legacy = token({ ref, role: "service_role" });
  assert.equal(stagingAdminHeaders(legacy, ref).Authorization, `Bearer ${legacy}`);
  for (const invalid of ["", "sb_publishable_test", "not-a-key", token({ ref: otherRef, role: "service_role" }), token({ ref, role: "anon" })]) {
    assert.throws(() => stagingAdminHeaders(invalid, ref));
  }
});

const buildEnv = {
  SITE_ID: target.siteId, BRANCH: target.branch, HTP_ENVIRONMENT: "staging",
  NEXT_PUBLIC_SITE_URL: target.siteUrl, NEXT_PUBLIC_SUPABASE_URL: url,
  HTP_STAGING_SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic_only", EMAIL_MODE: "disabled", CHAT_EMAIL_MODE: "disabled",
};

test("the app build is allowed only for the staging site, branch, domain and database", () => {
  assert.equal(assertStagingBuildEnvironment(buildEnv, target).projectRef, ref);
  for (const invalid of [
    { SITE_ID: "8c1e7273-8140-4a47-88e7-9dbd11241229" },
    { BRANCH: "main" }, { HTP_ENVIRONMENT: "production" },
    { NEXT_PUBLIC_SITE_URL: "https://hettradeplatform.be" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://swohtycdqbydqrtjzwwf.supabase.co" },
    { HTP_STAGING_SUPABASE_PROJECT_REF: "" }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
    { SUPABASE_SERVICE_ROLE_KEY: "" }, { STRIPE_SECRET_KEY: "sk_live_synthetic_only" },
    { EMAIL_MODE: "live" }, { CHAT_EMAIL_MODE: "live" },
  ]) assert.throws(() => assertStagingBuildEnvironment({ ...buildEnv, ...invalid }, target));
  assert.doesNotThrow(() => assertStagingBuildEnvironment({ ...buildEnv, STRIPE_SECRET_KEY: "sk_test_synthetic_only", EMAIL_MODE: "dry_run" }, target));
});

test("missing Dylan configuration blocks the build before any npm subprocess starts", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../../scripts/staging-build.mjs", import.meta.url))], {
    encoding: "utf8", env: { PATH: process.env.PATH, SITE_ID: target.siteId, BRANCH: target.branch, HTP_ENVIRONMENT: "staging", NEXT_PUBLIC_SITE_URL: target.siteUrl }, timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(result.stdout, /npm|next build/);
});
