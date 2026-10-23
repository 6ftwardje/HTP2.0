const PROTECTED_PROJECTS = new Map([
  ["swohtycdqbydqrtjzwwf", "HTP2 production"],
  ["trogwrgxxhsvixzglzpn", "legacy production"],
]);
const PROJECT_REF = /^[a-z0-9]{20}$/;

/** Validate before any request, including read-only schema checks. */
export function assertStagingSupabaseTarget({ url, expectedProjectRef }) {
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new Error("Set NEXT_PUBLIC_SUPABASE_URL to the staging project HTTPS URL."); }

  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
  if (!match || parsed.protocol !== "https:" || parsed.port || parsed.username ||
      parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("The staging target must be an HTTPS project URL: https://<project-ref>.supabase.co.");
  }
  const projectRef = match[1];
  if (PROTECTED_PROJECTS.has(projectRef)) {
    throw new Error(`Refusing protected ${PROTECTED_PROJECTS.get(projectRef)} project (${projectRef}); no request was sent.`);
  }
  if (!PROJECT_REF.test(expectedProjectRef ?? "") || PROTECTED_PROJECTS.has(expectedProjectRef)) {
    throw new Error("Set HTP_STAGING_SUPABASE_PROJECT_REF explicitly to Dylan's staging project ref.");
  }
  if (projectRef !== expectedProjectRef) {
    throw new Error("Supabase URL does not match HTP_STAGING_SUPABASE_PROJECT_REF; no request was sent.");
  }
  return { projectRef, url: parsed.origin };
}

/** Opaque secret keys belong in apikey, not a JWT Bearer header. */
export function stagingAdminHeaders(key, projectRef) {
  if (typeof key !== "string" || !key) throw new Error("Set the staging SUPABASE_SERVICE_ROLE_KEY server secret.");
  if (key.startsWith("sb_secret_")) return { apikey: key };
  let claims;
  try {
    if (key.split(".").length !== 3) throw new Error("Invalid JWT");
    claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
  } catch { throw new Error("Use a staging secret key or a legacy service_role JWT."); }
  if (claims?.role !== "service_role" || claims?.ref !== projectRef) {
    throw new Error("The legacy server key must belong to the selected staging project and have role service_role.");
  }
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export function assertStagingBuildEnvironment(env, target) {
  if (env.SITE_ID !== target.siteId) throw new Error("Staging build refused: wrong Netlify SITE_ID.");
  if (env.BRANCH !== target.branch) throw new Error("Staging build refused: wrong Git branch.");
  if (env.HTP_ENVIRONMENT !== "staging") throw new Error("Staging build refused: HTP_ENVIRONMENT must be staging.");
  if (env.NEXT_PUBLIC_SITE_URL !== target.siteUrl) throw new Error("Staging build refused: wrong NEXT_PUBLIC_SITE_URL.");
  const database = assertStagingSupabaseTarget({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    expectedProjectRef: env.HTP_STAGING_SUPABASE_PROJECT_REF,
  });
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Set the staging publishable key.");
  stagingAdminHeaders(env.SUPABASE_SERVICE_ROLE_KEY, database.projectRef);
  if (env.STRIPE_SECRET_KEY && !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY)) {
    throw new Error("Staging build refused: Stripe must use test credentials.");
  }
  for (const name of ["EMAIL_MODE", "CHAT_EMAIL_MODE"]) {
    if (env[name] && !["disabled", "dry_run"].includes(env[name])) {
      throw new Error(`Staging build refused: ${name} must be disabled or dry_run.`);
    }
  }
  return database;
}
