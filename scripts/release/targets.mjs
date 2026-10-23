import assert from 'node:assert/strict';

export const TARGETS = Object.freeze({
  staging: Object.freeze({ projectRef: 'pxxpciwnvfkxnkpttajp', siteId: 'd798281b-ff2a-48bb-9ecf-3b9dea2a7c21',
    siteUrl: 'https://htp-staging.netlify.app', branch: 'codex/staging', pooler: 'aws-0-eu-west-1.pooler.supabase.com' }),
  production: Object.freeze({ projectRef: 'swohtycdqbydqrtjzwwf', siteId: '8c1e7273-8140-4a47-88e7-9dbd11241229',
    siteUrl: 'https://hettradeplatform.be', branch: 'main', pooler: 'aws-0-eu-west-3.pooler.supabase.com' }),
});

export function releaseTarget(env, { stagingOnly = false } = {}) {
  const name = env.HTP_ENVIRONMENT;
  assert.ok(Object.hasOwn(TARGETS,name), 'HTP_ENVIRONMENT must explicitly be staging or production.');
  assert.ok(!stagingOnly || name === 'staging', 'Bootstrap and dummy data are staging-only.');
  const target = TARGETS[name];
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, `https://${target.projectRef}.supabase.co`, 'Wrong Supabase target.');
  assert.equal(env.NEXT_PUBLIC_SITE_URL, target.siteUrl, 'Wrong public site URL.');
  assert.equal(env.SITE_ID,target.siteId,'Wrong Netlify site.');
  if (name === 'staging') assert.equal(env.HTP_STAGING_SUPABASE_PROJECT_REF,target.projectRef,'Wrong staging project ref.');
  return { ...target, name };
}

export function databaseEnvironment(env, target, { readOnly = false } = {}) {
  assert.ok(env.SUPABASE_DB_PASSWORD, 'Set SUPABASE_DB_PASSWORD in the private environment configuration.');
  return { ...process.env, PGHOST: target.pooler, PGPORT: '5432', PGUSER: `postgres.${target.projectRef}`,
    PGDATABASE: 'postgres', PGPASSWORD: env.SUPABASE_DB_PASSWORD, PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15',
    PGOPTIONS: readOnly ? '-c default_transaction_read_only=on -c statement_timeout=60000' : '-c statement_timeout=120000 -c lock_timeout=15000' };
}

export function assertSafeStagingIntegrations(env) {
  for (const mode of ['EMAIL_MODE','CHAT_EMAIL_MODE']) assert.ok(['disabled','dry_run'].includes(env[mode]), `${mode} must explicitly be disabled or dry_run.`);
  for (const name of ['EMAIL_CAPTURE_ENABLED','EMAIL_MARKETING_ENABLED','EMAIL_PURCHASE_ENABLED','EMAIL_EXPIRY_ENABLED','EMAIL_MENTOR_ENABLED','CHAT_MAINTENANCE_ENABLED'])
    assert.equal(env[name],'false',`${name} must explicitly be false.`);
  if (env.STRIPE_SECRET_KEY) assert.match(env.STRIPE_SECRET_KEY,/^(sk|rk)_test_/,'Staging refuses Stripe live keys.');
  for (const name of ['ANTHROPIC_API_KEY','OPENAI_API_KEY','MUX_TOKEN_ID','MUX_TOKEN_SECRET','RESEND_API_KEY'])
    assert.ok(!env[name], `Initial staging must not contain ${name}; configure a separately verified test integration later.`);
}

export function assertReleaseCandidate({ candidate, deployed, tested, mainIsAncestor }) {
  assert.match(candidate ?? '',/^[a-f0-9]{40}$/,'Release requires a full commit SHA.');
  assert.equal(deployed,candidate,'The candidate must be the deployed staging commit.');
  assert.equal(tested,candidate,'The candidate must have a successful staging acceptance receipt.');
  assert.equal(mainIsAncestor,true,'Production history must be an ancestor; synchronize staging before promotion.');
}

export function assertNetlifyLink(state,target) {
  assert.equal(state?.siteId,target.siteId,'This checkout is linked to a different Netlify site.');
}

export function releaseCandidate(env,deployed) { return env.HTP_CANDIDATE_SHA || deployed; }
