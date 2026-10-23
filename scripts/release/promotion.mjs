import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TARGETS,assertReleaseCandidate,releaseCandidate } from './targets.mjs';

const repo=process.env.GITHUB_REPOSITORY ?? '6ftwardje/HTP2.0';assert.equal(repo,'6ftwardje/HTP2.0');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(r.status,0,`${cmd} failed during release verification.`);return r.stdout.trim();};
const health=await(await fetch(TARGETS.staging.siteUrl+'/api/health',{redirect:'error',signal:AbortSignal.timeout(15000)})).json();
assert.equal(health.environment,'staging');
const candidate=releaseCandidate(process.env,health.commit);
assert.match(candidate,/^[a-f0-9]{40}$/);
const runs=JSON.parse(run('gh',['api',`repos/${repo}/actions/workflows/staging-deploy.yml/runs?branch=codex%2Fstaging&status=success&per_page=50`]));
const verified=runs.workflow_runs.find(r=>r.head_sha===candidate&&r.event==='push');assert.ok(verified,'No successful staging deployment workflow for this commit.');
const dir=mkdtempSync(path.join(tmpdir(),'htp-release-receipt-'));
try {
  run('gh',['run','download',String(verified.id),'--repo',repo,'--name','staging-release-receipt','--dir',dir]);
  const receipt=JSON.parse(readFileSync(path.join(dir,'receipt.json'),'utf8'));
  run('git',['fetch','origin','main','codex/staging']);
  const ancestor=process.env.HTP_PROMOTION_MODE==='production'?candidate:'origin/main';
  const descendant=process.env.HTP_PROMOTION_MODE==='production'?'HEAD':candidate;
  const ancestry=spawnSync('git',['merge-base','--is-ancestor',ancestor,descendant]);
  assertReleaseCandidate({candidate,deployed:health.commit,tested:receipt.sha,mainIsAncestor:ancestry.status===0});
  assert.equal(run('git',['rev-parse',`${candidate}^{tree}`]),receipt.tree,'Receipt tree differs from source.');
  if(process.env.HTP_PROMOTION_MODE==='production')assert.equal(run('git',['rev-parse','HEAD^{tree}']),receipt.tree,'Main contains code that was not accepted on staging. Use a merge commit for the release PR.');
  console.log(`PASS: staging commit ${candidate}, source tree, deployment and acceptance receipt agree.`);
} finally {rmSync(dir,{recursive:true,force:true});}
