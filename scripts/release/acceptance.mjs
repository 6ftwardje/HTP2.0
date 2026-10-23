import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { releaseTarget } from './targets.mjs';

export async function acceptance(env=process.env) {
  const target=releaseTarget(env,{stagingOnly:true});
  const base=new URL(env.HTP_ACCEPTANCE_URL ?? target.siteUrl);
  assert.ok(base.protocol==='https:' && (base.hostname==='htp-staging.netlify.app' || /^[a-f0-9]+--htp-staging\.netlify\.app$/.test(base.hostname)), 'Acceptance refuses a non-staging website.');
  const password=env.HTP_STAGING_TEST_PASSWORD;
  assert.ok(password,'Private staging test password required.');
  const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const students=await admin.from('students').select('id,email').like('email','%@staging.htp.test');
  assert.ifError(students.error);assert.equal(students.data.length,5,'Expected five idempotent dummy accounts.');
  const byEmail=new Map(students.data.map(s=>[s.email,s.id]));
  const actors={};
  for(const name of ['admin','mentor','member','free','member2']) {
    const jar=new Map();
    const db=createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{
      getAll:()=>[...jar].map(([name,value])=>({name,value})),
      setAll:changes=>changes.forEach(({name,value})=>jar.set(name,value)),
    },auth:{autoRefreshToken:false}});
    const signed=await db.auth.signInWithPassword({email:`${name}@staging.htp.test`,password});
    assert.ifError(signed.error);actors[name]={db,cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')};
  }
  console.log('PASS: all five dummy roles authenticate through the real staging Auth service.');
  const freeModules=await actors.free.db.from('modules').select('id').eq('is_published',true);
  assert.ifError(freeModules.error);assert.ok(freeModules.data.some(m=>m.id===900001));
  const concept=await actors.member.db.from('modules').select('id').eq('id',900003);
  assert.ok(concept.error || !concept.data.length,'Members must not read the draft module.');
  const draftUpdate=await actors.member.db.from('weekly_updates').select('id').eq('id',900005);
  assert.ok(draftUpdate.error || !draftUpdate.data.length,'Members must not read the draft analysis.');
  const foreignProgress=await actors.member2.db.from('progress').select('id').eq('student_id',byEmail.get('member@staging.htp.test'));
  assert.ok(foreignProgress.error || !foreignProgress.data.length,'Members must not read another member’s progress.');
  const providerSecrets=await actors.member.db.from('live_session_provider_secrets').select('*');
  assert.ok(providerSecrets.error || !providerSecrets.data.length,'Provider secrets must stay server-only.');
  const leakedAnswers=await actors.member.db.from('exam_answer_options').select('is_correct').limit(1);
  assert.ok(leakedAnswers.error || !leakedAnswers.data.length,'Correct exam answers must not be directly readable.');
  const unauth=await anon.rpc('open_chat_thread',{p_mentor_student_id:byEmail.get('mentor@staging.htp.test')});
  assert.ok(unauth.error,'Anonymous chat creation must fail.');
  console.log('PASS: draft content, foreign progress, answer keys and provider secrets are protected.');
  const access=await actors.mentor.db.rpc('get_my_chat_access');assert.ifError(access.error);assert.equal(access.data.isMentor,true);
  const unrelatedAdmin=await actors.admin.db.rpc('get_my_chat_access');assert.ifError(unrelatedAdmin.error);assert.equal(unrelatedAdmin.data.isMentor,false);
  const opened=await actors.member.db.rpc('open_chat_thread',{p_mentor_student_id:byEmail.get('mentor@staging.htp.test')});assert.ifError(opened.error);
  const threadId=opened.data.threadId;
  assert.ok(threadId,'Opening the chat did not return its canonical thread.');
  const send=()=>actors.member.db.rpc('send_chat_message',{p_thread_id:threadId,p_body:'Fictieve vraag voor de stagingacceptatie.',p_client_message_id:'40000000-0000-4000-8000-000000000001',p_is_internal:false});
  const sent=await send();assert.ifError(sent.error);const retried=await send();assert.ifError(retried.error);
  assert.equal(sent.data.message.id,retried.data.message.id,'Retry created a duplicate chat message.');
  const reply=await actors.mentor.db.rpc('send_chat_message',{p_thread_id:threadId,p_body:'Fictief mentorantwoord: de stagingchat werkt.',p_client_message_id:'40000000-0000-4000-8000-000000000002',p_is_internal:false});assert.ifError(reply.error);
  for(const name of ['member2','admin']){const foreign=await actors[name].db.from('conversation_messages').select('id').eq('thread_id',threadId);
    assert.ok(foreign.error||!foreign.data.length,`${name} read a private mentor conversation.`);}
  console.log('PASS: explicit mentor routing works and the unrelated admin is not a mentor.');
  const healthResponse=await fetch(new URL('/api/health',base),{redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.equal(healthResponse.status,200);const health=await healthResponse.json();assert.equal(health.environment,'staging');
  if(env.HTP_RELEASE_SHA)assert.equal(health.commit,env.HTP_RELEASE_SHA,'The deployed application is a different release.');
  assert.match(healthResponse.headers.get('x-robots-tag') ?? '',/noindex/);
  for(const [name,routes] of Object.entries({member:['/dashboard','/modules','/market-analysis','/live-sessions','/mentor'],admin:['/admin','/admin/live-sessions','/admin/students']}))
    for(const route of routes){const response=await fetch(new URL(route,base),{headers:{Cookie:actors[name].cookie},redirect:'manual',signal:AbortSignal.timeout(30000)});
      assert.equal(response.status,200,`${name} ${route} failed (${response.status}).`);const html=await response.text();assert.match(html,/STAGING/,'The staging label is missing.');}
  const blocked=await fetch(new URL('/admin/students',base),{headers:{Cookie:actors.member.cookie},redirect:'manual',signal:AbortSignal.timeout(30000)});
  assert.ok([403,404].includes(blocked.status),'Member reached an admin route.');
  const robots=await fetch(new URL('/robots.txt',base));assert.match(await robots.text(),/Disallow:\s*\//);
  console.log('PASS: authenticated student/admin routes, release identity, noindex and admin denial.');
  return health;
}

if(process.argv[1] && import.meta.url===new URL(process.argv[1],'file:').href)acceptance().catch(e=>{console.error(e.message);process.exitCode=1;});
