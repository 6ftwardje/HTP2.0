/** Fresh, local-only baseline + migration + fixture proof. No account token or remote connection. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { root,releaseFiles,schemaFingerprint } from './database.mjs';
import { postgres,sqlLiteral } from './postgres.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true','Run this fresh-stack rehearsal in the disposable CI runner.');
const directory=mkdtempSync(path.join(tmpdir(),'htp-release-rehearsal-'));
const supabaseRoot=path.join(directory,'supabase');mkdirSync(path.join(supabaseRoot,'migrations'),{recursive:true,mode:0o700});
const manifest=JSON.parse(readFileSync(path.join(root,'supabase/release/manifest.json')));
const locks=JSON.parse(readFileSync(path.join(root,'supabase/release/migration-lock.json')));
const files=releaseFiles(manifest);
let config=readFileSync(path.join(root,'supabase/config.toml'),'utf8')
  .replace(/^project_id\s*=.*$/m,`project_id = "htp-release-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}"`)
  .replace(/(\[db\.seed\][\s\S]*?)enabled = true/,'$1enabled = false');
writeFileSync(path.join(supabaseRoot,'config.toml'),config,{mode:0o600});
const read=name=>readFileSync(path.join(root,'supabase/release',name),'utf8');
writeFileSync(path.join(supabaseRoot,'migrations',manifest.version+'_production_baseline.sql'),read(manifest.file)+'\n'+read(manifest.extrasFile)+'\n'+read('staging-isolation.sql'),{mode:0o600});
for(const file of files)writeFileSync(path.join(supabaseRoot,'migrations',file.name),file.sql,{mode:0o600});
const cli=args=>{const result=spawnSync('supabase',['--workdir',directory,...args],{encoding:'utf8',timeout:12*60*1000,maxBuffer:16*1024*1024});
  assert.equal(result.status,0,`Local Supabase ${args[0]} failed. Last error: ${(result.stderr??'').split('\n').filter(x=>/^ERROR:/.test(x)).at(-1) ?? 'see isolated runner'}`);return result.stdout;};
try {
  cli(['start','--exclude','studio,postgres-meta,imgproxy,edge-runtime,logflare,vector,supavisor']);
  const status=cli(['status','-o','env']);
  const values=Object.fromEntries([...status.matchAll(/^([A-Z_]+)="([^"\r\n]*)"$/gm)].map(m=>[m[1],m[2]]));
  if(!values.API_URL){const result=JSON.parse(status);Object.assign(values,result);}
  const url=new URL(values.DB_URL);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  assert.ok(['127.0.0.1','localhost'].includes(new URL(values.API_URL).hostname));
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port,PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1)};
  const expected=files.length?locks[files.at(-1).version].stagingSchemaFingerprint:manifest.stagingSchemaFingerprint;
  assert.equal(schemaFingerprint(env),expected,'Fresh replay differs from the audited staging schema, including privileges.');
  const password=randomBytes(24).toString('base64url');
  postgres("create schema if not exists supabase_migrations;create table supabase_migrations.htp_release_environment(environment text,project_ref text);insert into supabase_migrations.htp_release_environment values('staging','pxxpciwnvfkxnkpttajp');",env);
  const seed=`begin;select set_config('htp.fixture_password',${sqlLiteral(password)},true);${read('staging-fixtures.sql')}\ncommit;`;
  postgres(seed,env);postgres(seed,env);
  assert.equal(postgres("select count(*) from public.students",env),'5','Repeated seed created duplicate accounts.');
  for(const name of ['admin','mentor','member','free','member2']){
    const db=createClient(values.API_URL,values.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const signed=await db.auth.signInWithPassword({email:`${name}@staging.htp.test`,password});assert.ifError(signed.error);
    const access=await db.rpc('get_my_chat_access');assert.ifError(access.error);assert.equal(access.data.isMentor,name==='mentor');
    if(name==='member'){
      const draft=await db.from('weekly_updates').select('id').eq('id',900005);assert.ok(draft.error||!draft.data.length);
      const answers=await db.from('exam_answer_options').select('is_correct');assert.ok(answers.error||!answers.data.length);
    }
  }
  assert.equal(schemaFingerprint(env),expected,'Seeding changed the schema.');
  console.log('PASS: fresh audited baseline, pending migrations, exact ACL/RLS/trigger fingerprint, repeated dummy seeding and five authenticated roles.');
} finally {
  spawnSync('supabase',['--workdir',directory,'stop','--no-backup'],{encoding:'utf8',timeout:120000});
  rmSync(directory,{recursive:true,force:true});
}
