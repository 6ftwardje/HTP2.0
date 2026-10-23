import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync,readFileSync,mkdirSync } from 'node:fs';
import { releaseTarget,assertSafeStagingIntegrations } from './targets.mjs';
import { acceptance } from './acceptance.mjs';
import { main as database, schemaFingerprint } from './database.mjs';
import { databaseEnvironment } from './targets.mjs';

const env=process.env,target=releaseTarget(env);
assert.ok(process.argv.includes('--apply'),'Deployment requires --apply.');
assert.match(env.HTP_RELEASE_SHA ?? '',/^[a-f0-9]{40}$/,'Set the exact release commit.');
if(target.name==='staging')assertSafeStagingIntegrations(env);
if(target.name==='production')assert.equal(env.HTP_PRODUCTION_APPROVED,'true','Production is released only by the approved GitHub environment job.');
database(env,['migrate','--apply']);database(env,['verify']);
mkdirSync('.netlify/release',{recursive:true,mode:0o700});
const command=env.GITHUB_ACTIONS==='true'?'npx':'netlify';
const prefix=env.GITHUB_ACTIONS==='true'?['--yes','netlify-cli@26.2.0']:[];
const result=spawnSync(command,[...prefix,'deploy','--site',target.siteId,'--context',target.name==='staging'?'branch:codex/staging':'production',
  '--message',`HTP ${target.name} ${env.HTP_RELEASE_SHA}`,'--json'],{
  env:{...env,BRANCH:target.branch,SITE_ID:target.siteId,COMMIT_REF:env.HTP_RELEASE_SHA,NEXT_TELEMETRY_DISABLED:'1'},encoding:'utf8',timeout:20*60*1000,maxBuffer:32*1024*1024,
});
writeFileSync('.netlify/release/build.log',result.stdout+'\n'+result.stderr,{mode:0o600});
assert.equal(result.status,0,'Draft build/deploy failed. Inspect the private build log; the live site has not been replaced.');
// Netlify prints build output before its final JSON object.
const candidates=[...result.stdout.matchAll(/^\{\n[\s\S]*?^\}/gm)].map(m=>{try{return JSON.parse(m[0]);}catch{return null;}}).filter(Boolean);
const deploy=candidates.findLast(x=>x.deploy_id&&x.deploy_url);
assert.ok(deploy,'Netlify did not return a draft deployment receipt.');
if(target.name==='staging')await acceptance({...env,HTP_ACCEPTANCE_URL:deploy.deploy_url});
else {
  const response=await fetch(new URL('/api/health',deploy.deploy_url),{redirect:'error',signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200);const health=await response.json();assert.equal(health.commit,env.HTP_RELEASE_SHA);assert.equal(health.environment,'production');
  assert.equal((await fetch(new URL('/login',deploy.deploy_url))).status,200);
}
const netlify=(operation,data)=>{
  const r=spawnSync(command,[...prefix,'api',operation,'--data',JSON.stringify(data)],{env,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,`Netlify ${operation} failed.`);return JSON.parse(r.stdout);
};
const site=netlify('getSite',{site_id:target.siteId});
assert.equal(site.id,target.siteId);
const previous=site.published_deploy?.id;
netlify('restoreSiteDeploy',{site_id:target.siteId,deploy_id:deploy.deploy_id});
const verified=netlify('getSite',{site_id:target.siteId});assert.equal(verified.published_deploy.id,deploy.deploy_id);
try {
  const published=await fetch(new URL('/api/health',target.siteUrl),{redirect:'error',signal:AbortSignal.timeout(30000)});
  assert.equal(published.status,200);const health=await published.json();assert.equal(health.commit,env.HTP_RELEASE_SHA);
} catch(error) {
  if(previous){netlify('restoreSiteDeploy',{site_id:target.siteId,deploy_id:previous});
    assert.equal(netlify('getSite',{site_id:target.siteId}).published_deploy.id,previous);}
  throw new Error('Published health check failed; the previous website deployment was restored. Database migrations remain applied.');
}
const receipt={environment:target.name,sha:env.HTP_RELEASE_SHA,tree:spawnSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).stdout.trim(),
  deployId:deploy.deploy_id,previousDeployId:previous,url:target.siteUrl,checkedAt:new Date().toISOString(),schemaFingerprint:schemaFingerprint(databaseEnvironment(env,target,{readOnly:true}))};
writeFileSync('.netlify/release/receipt.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(`PASS: tested ${target.name} release ${receipt.sha} published at ${receipt.url}. Previous deploy: ${previous}`);
