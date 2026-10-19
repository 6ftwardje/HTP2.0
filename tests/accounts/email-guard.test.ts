import assert from 'node:assert/strict';import test from 'node:test';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';import ts from'typescript';
function repository(handler:(name:string)=>unknown){const calls:string[]=[];const db={rpc:async(name:string)=>{calls.push(name);return handler(name);}};const deps:Record<string,unknown>={'server-only':{},'@/lib/supabase/service':{},'./resend':{},'./policy':{},'./worker':{},'@/lib/chat-attachments-server':{}};const mod={exports:{} as {chatEmailRepository:(db:unknown)=>any}};runInNewContext(ts.transpileModule(readFileSync('lib/chat-notifications/server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,module:mod,process:{env:{}},require:(name:string)=>{assert.ok(name in deps,name);return deps[name];}});return{repo:mod.exports.chatEmailRepository(db),calls};}
const job={id:'own-job',lease_token:'own-lease'};
test('a classified account cannot expose a recipient snapshot or prepare outgoing mail',async()=>{
 const{repo,calls}=repository(()=>({data:false,error:null}));assert.deepEqual(JSON.parse(JSON.stringify(await repo.snapshot(job))),{allowed:false,reason:'synthetic_account'});assert.equal(await repo.prepare(job,{}),null);assert.ok(calls.every(name=>name==='test_account_chat_email_allowed'));
});
test('classification is rechecked after the snapshot and before the provider payload is frozen',async()=>{
 let allowed=true;const{repo,calls}=repository(name=>({data:name==='test_account_chat_email_allowed'?allowed:{allowed:true},error:null}));assert.equal((await repo.snapshot(job)).allowed,true);allowed=false;assert.equal(await repo.prepare(job,{}),null);assert.equal(calls.filter(x=>x==='test_account_chat_email_allowed').length,2);assert.ok(!calls.includes('prepare_chat_email_send'));
});
test('missing classification RPC fails closed rather than calling the original send preparation',async()=>{
 const{repo,calls}=repository(()=>({data:null,error:{code:'PGRST202'}}));await assert.rejects(repo.snapshot(job),/chat_notification_database_failed/);await assert.rejects(repo.prepare(job,{}),/chat_notification_database_failed/);assert.ok(!calls.includes('prepare_chat_email_send'));
});
