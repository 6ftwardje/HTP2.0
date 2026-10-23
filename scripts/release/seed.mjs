import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseTarget, databaseEnvironment, assertSafeStagingIntegrations } from './targets.mjs';
import { postgres, sqlLiteral } from './postgres.mjs';

const target=releaseTarget(process.env,{stagingOnly:true});
assertSafeStagingIntegrations(process.env);
assert.ok(process.argv.includes('--apply'),'Dummy seeding requires explicit --apply.');
const password=process.env.HTP_STAGING_TEST_PASSWORD;
assert.ok(password&&password.length>=20,'Set a private HTP_STAGING_TEST_PASSWORD with at least twenty characters.');
const sql=readFileSync(new URL('../../supabase/release/staging-fixtures.sql',import.meta.url),'utf8');
const env=databaseEnvironment(process.env,target);
postgres(`begin;select pg_advisory_xact_lock(7160231023);select set_config('htp.fixture_password',${sqlLiteral(password)},true);${sql}\ncommit;`,env);
console.log('PASS: staging dummy accounts, courses, exam questions, progress, market updates, sessions and notifications seeded. Existing fixture rows retained.');
