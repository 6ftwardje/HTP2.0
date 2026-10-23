import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { releaseTarget, databaseEnvironment } from './targets.mjs';
import { postgres, sqlLiteral } from './postgres.mjs';

export const root = fileURLToPath(new URL('../../',import.meta.url));
const baselinePath = path.join(root,'supabase/release');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const schemaInventory = readFileSync(path.join(baselinePath,'schema-inventory.sql'),'utf8').trim().replace(/;$/,'');
export const schemaFingerprint = env => sha256(postgres(schemaInventory,env));

export function releaseFiles(manifest) {
  return readdirSync(path.join(root,'supabase/migrations')).filter(name=>/^\d{14}_.+\.sql$/.test(name) && name.slice(0,14)>manifest.version).sort()
    .map(name=>({name,version:name.slice(0,14),sql:readFileSync(path.join(root,'supabase/migrations',name),'utf8')}));
}

export function assertHistory(files,history) {
  const byVersion = new Map(files.map(file=>[file.version,file]));
  for (const entry of history) {
    const file=byVersion.get(entry.version);
    assert.ok(file,`Applied release migration ${entry.version} is missing from Git.`);
    assert.equal(sha256(file.sql),entry.sha256,`Applied migration ${file.name} was changed. Add a new migration instead.`);
  }
  const seen=new Set();
  for(const file of files){assert.ok(!seen.has(file.version),'Duplicate migration version.');seen.add(file.version);}
  return files.filter(file=>!history.some(entry=>entry.version===file.version));
}

export function main(env=process.env,args=process.argv.slice(2)) {
  const [command='verify']=args;
  assert.ok(['verify','plan','bootstrap','migrate'].includes(command),'Use verify, plan, bootstrap, or migrate.');
  const target=releaseTarget(env,{stagingOnly:command==='bootstrap'});
  const dbEnv=databaseEnvironment(env,target,{readOnly:!args.includes('--apply')});
  const manifest=JSON.parse(readFileSync(path.join(baselinePath,'manifest.json'),'utf8'));
  const snapshot=readFileSync(path.join(baselinePath,manifest.file),'utf8');
  const extras=readFileSync(path.join(baselinePath,manifest.extrasFile),'utf8');
  assert.equal(sha256(snapshot),manifest.sha256,'Baseline SQL changed; review and regenerate its manifest.');
  assert.equal(sha256(extras),manifest.extrasSha256,'Baseline auth/storage configuration changed.');
  assert.equal(sha256(readFileSync(path.join(baselinePath,'staging-isolation.sql'))),manifest.isolationSha256,'Staging isolation configuration changed.');

  if(command==='bootstrap'){
    assert.equal(args.includes('--apply'),true,'Bootstrap needs explicit --apply.');
    const count=Number(postgres("select count(*) from pg_tables where schemaname='public'",dbEnv));
    assert.equal(count,0,'Bootstrap requires an empty staging public schema. Never reset an existing database.');
    postgres(`begin; select pg_advisory_xact_lock(7160231023);
      do $$ begin if exists(select 1 from pg_tables where schemaname='public') then raise exception 'Staging no longer empty'; end if; end $$;
      create extension if not exists pgcrypto with schema extensions;
      create extension if not exists "uuid-ossp" with schema extensions;
      ${snapshot}\n${extras}\ncommit;`,dbEnv);
    assert.equal(schemaFingerprint(dbEnv),manifest.schemaFingerprint,'Restored staging schema differs from the captured production schema.');
    postgres(readFileSync(path.join(baselinePath,'staging-isolation.sql'),'utf8'),dbEnv);
    console.log(`PASS: schema-only baseline restored into ${target.name}; no production data copied.`);
  }

  const hasLedger=postgres("select to_regclass('supabase_migrations.htp_release_checksums') is not null",dbEnv)==='t';
  if(!hasLedger){
    assert.equal(schemaFingerprint(dbEnv),target.name==='staging'?manifest.stagingSchemaFingerprint:manifest.schemaFingerprint,'Untracked schema drift. Reconcile it before adopting the release baseline.');
    assert.notEqual(command,'verify','The release baseline has not been adopted.');
    if(!args.includes('--apply')){console.log('PASS: current schema matches the release baseline; ledger adoption pending.');return;}
    postgres(`begin; select pg_advisory_xact_lock(7160231023);
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.htp_release_baseline(version text primary key,sha256 text not null,schema_fingerprint text not null,created_at timestamptz not null default now());
      create table if not exists supabase_migrations.htp_release_checksums(version text primary key,name text not null,sha256 text not null,applied_at timestamptz not null default now());
      insert into supabase_migrations.htp_release_baseline(version,sha256,schema_fingerprint) values (${sqlLiteral(manifest.version)},${sqlLiteral(manifest.sha256)},${sqlLiteral(manifest.schemaFingerprint)}) on conflict do nothing;
      revoke all on supabase_migrations.htp_release_baseline,supabase_migrations.htp_release_checksums from public,anon,authenticated;
      commit;`,dbEnv);
  }
  if(args.includes('--apply')) postgres(`begin;
    create table if not exists supabase_migrations.htp_release_environment(environment text primary key,project_ref text not null);
    do $$ begin if exists(select 1 from supabase_migrations.htp_release_environment where environment<>${sqlLiteral(target.name)} or project_ref<>${sqlLiteral(target.projectRef)}) then raise exception 'Wrong database environment marker';end if;end $$;
    insert into supabase_migrations.htp_release_environment values(${sqlLiteral(target.name)},${sqlLiteral(target.projectRef)}) on conflict do nothing;
    revoke all on supabase_migrations.htp_release_environment from public,anon,authenticated;commit;`,dbEnv);
  const adopted=postgres('select row_to_json(b) from supabase_migrations.htp_release_baseline b',dbEnv,{json:true});
  assert.equal(adopted.version,manifest.version,'Wrong release baseline.');
  assert.equal(adopted.sha256,manifest.sha256,'Release baseline checksum differs.');
  const history=postgres("select coalesce(json_agg(c order by version),'[]') from supabase_migrations.htp_release_checksums c",dbEnv,{json:true});
  const files=releaseFiles(manifest);
  const locks=JSON.parse(readFileSync(path.join(baselinePath,'migration-lock.json'),'utf8'));
  for(const file of files)assert.equal(sha256(file.sql),locks[file.version]?.sha256,`Missing or stale schema lock for ${file.name}. Rehearse the migration and record the resulting schema.`);
  const pending=assertHistory(files,history);
  const fingerprintKey=target.name==='staging'?'stagingSchemaFingerprint':'schemaFingerprint';
  const currentFingerprint=history.length ? locks[history.at(-1).version][fingerprintKey] : manifest[fingerprintKey];
  assert.equal(schemaFingerprint(dbEnv),currentFingerprint,'Database schema drift detected; deployment stopped before migration or application publication.');
  console.log(JSON.stringify({environment:target.name,baseline:manifest.version,applied:history.length,pending:pending.map(f=>f.name)}));
  if(command==='verify') assert.equal(pending.length,0,'Unapplied release migrations.');
  if(command!=='migrate' || !args.includes('--apply'))return;
  for(const file of pending){
    // Postgres executes each version and its checksum under the same lock and transaction.
    postgres(`begin; select pg_advisory_xact_lock(7160231023);
      do $$ begin if exists(select 1 from supabase_migrations.htp_release_checksums where version=${sqlLiteral(file.version)}) then raise exception 'Concurrent migration completed; rerun the release'; end if; end $$;
      ${file.sql}
      insert into supabase_migrations.htp_release_checksums(version,name,sha256) values(${sqlLiteral(file.version)},${sqlLiteral(file.name)},${sqlLiteral(sha256(file.sql))});
      commit;`,dbEnv);
    console.log(`PASS: ${file.name}`);
    assert.equal(schemaFingerprint(dbEnv),locks[file.version][fingerprintKey],`Schema after ${file.name} differs from the rehearsed schema.`);
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
