import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseTarget, databaseEnvironment, assertSafeStagingIntegrations, assertReleaseCandidate, TARGETS } from '../../scripts/release/targets.mjs';
import { assertHistory, sha256 } from '../../scripts/release/database.mjs';

const staging = { HTP_ENVIRONMENT:'staging', SITE_ID:TARGETS.staging.siteId, NEXT_PUBLIC_SITE_URL:TARGETS.staging.siteUrl,
  NEXT_PUBLIC_SUPABASE_URL:`https://${TARGETS.staging.projectRef}.supabase.co`,HTP_STAGING_SUPABASE_PROJECT_REF:TARGETS.staging.projectRef };
test('staging mutations reject production, legacy, lookalike URLs and a wrong site before opening Postgres',()=>{
  for(const patch of [{NEXT_PUBLIC_SUPABASE_URL:'https://swohtycdqbydqrtjzwwf.supabase.co'},
    {NEXT_PUBLIC_SUPABASE_URL:'https://trogwrgxxhsvixzglzpn.supabase.co'},
    {NEXT_PUBLIC_SUPABASE_URL:`https://${TARGETS.staging.projectRef}.supabase.co.evil.test`},
    {NEXT_PUBLIC_SUPABASE_URL:`https://${TARGETS.staging.projectRef}.supabase.co/`},
    {SITE_ID:TARGETS.production.siteId},{HTP_STAGING_SUPABASE_PROJECT_REF:''},{HTP_ENVIRONMENT:''}])
    assert.throws(()=>releaseTarget({...staging,...patch},{stagingOnly:true}));
  assert.equal(releaseTarget(staging,{stagingOnly:true}).projectRef,TARGETS.staging.projectRef);
});
test('production can never be a bootstrap or dummy seed target',()=>{
  const env={...staging,HTP_ENVIRONMENT:'production',SITE_ID:TARGETS.production.siteId,
    NEXT_PUBLIC_SITE_URL:TARGETS.production.siteUrl,NEXT_PUBLIC_SUPABASE_URL:`https://${TARGETS.production.projectRef}.supabase.co`};
  assert.throws(()=>releaseTarget(env,{stagingOnly:true}),/staging-only/);
  assert.equal(releaseTarget(env).name,'production');
});
test('database credentials stay in subprocess environment, with a fixed session-pooler target',()=>{
  const pg=databaseEnvironment({SUPABASE_DB_PASSWORD:'synthetic password'},TARGETS.staging,{readOnly:true});
  assert.equal(pg.PGHOST,TARGETS.staging.pooler);assert.equal(pg.PGUSER,`postgres.${TARGETS.staging.projectRef}`);
  assert.equal(pg.PGSSLMODE,'require');assert.match(pg.PGOPTIONS,/default_transaction_read_only=on/);
  assert.throws(()=>databaseEnvironment({},TARGETS.staging));
});
test('a release cannot substitute a different or untested staging commit',()=>{
  const sha='a'.repeat(40),other='b'.repeat(40);
  const valid={candidate:sha,deployed:sha,tested:sha,mainIsAncestor:true};
  assert.doesNotThrow(()=>assertReleaseCandidate(valid));
  for(const patch of [{candidate:'main'},{deployed:other},{tested:other},{mainIsAncestor:false}])
    assert.throws(()=>assertReleaseCandidate({...valid,...patch}));
});
test('an applied migration is immutable and cannot disappear from Git',()=>{
  const f={version:'20261023010000',name:'example.sql',sql:'select 1;'};
  const h=[{version:f.version,sha256:sha256(f.sql)}];
  assert.deepEqual(assertHistory([f],h),[]);
  assert.throws(()=>assertHistory([{...f,sql:'select 2;'}],h),/changed/);
  assert.throws(()=>assertHistory([],h),/missing/);
  assert.throws(()=>assertHistory([f,f],[]),/Duplicate/);
  assert.deepEqual(assertHistory([f],[]),[f]);
});
test('staging explicitly disables application email, maintenance and unverified live providers',()=>{
  const env={EMAIL_MODE:'disabled',CHAT_EMAIL_MODE:'disabled',EMAIL_CAPTURE_ENABLED:'false',EMAIL_MARKETING_ENABLED:'false',
    EMAIL_PURCHASE_ENABLED:'false',EMAIL_EXPIRY_ENABLED:'false',EMAIL_MENTOR_ENABLED:'false',CHAT_MAINTENANCE_ENABLED:'false'};
  assert.doesNotThrow(()=>assertSafeStagingIntegrations(env));
  for(const patch of [{EMAIL_MODE:'live'},{CHAT_EMAIL_MODE:''},{CHAT_MAINTENANCE_ENABLED:'true'},
    {STRIPE_SECRET_KEY:'sk_live_synthetic'},{MUX_TOKEN_SECRET:'synthetic'},{ANTHROPIC_API_KEY:'synthetic'}])
    assert.throws(()=>assertSafeStagingIntegrations({...env,...patch}));
});
