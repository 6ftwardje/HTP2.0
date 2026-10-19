/** Isolated synthetic Auth recovery roundtrip. Never targets a remote project or sends SMTP. */
import{createClient}from'@supabase/supabase-js';import{randomUUID}from'node:crypto';import{readFileSync,writeFileSync,unlinkSync,existsSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import assert from'node:assert/strict';
const url=process.env.API_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
if(!/^http:\/\/(127\.0\.0\.1|localhost):64321$/.test(url??''))throw new Error('Recovery verification and cleanup are loopback-only.');
const service=createClient(url,process.env.SERVICE_ROLE_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=process.env.ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const cleanupOnly=process.argv.indexOf('--cleanup');const file=cleanupOnly>=0?process.argv[cleanupOnly+1]:(process.env.HTP_RECOVERY_MANIFEST??join(tmpdir(),'htp-recovery-'+randomUUID()+'.json'));
if(!file)throw new Error('Provide the private cleanup manifest path.');
const state=cleanupOnly>=0?JSON.parse(readFileSync(file,'utf8')):{runId:randomUUID()};
assert.match(state.runId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);const email=`password-recovery-check-${state.runId}@example.invalid`;
const save=()=>writeFileSync(file,JSON.stringify(state),{mode:0o600});
function ok(result,label){if(result.error)throw new Error(label+': '+result.error.code);return result.data;}
async function cleanup(){
 let user=null;if(state.userId){const r=await service.auth.admin.getUserById(state.userId);if(r.error&&r.error.status!==404)throw new Error('Could not verify own Auth identity');user=r.data?.user;}
 if(!state.userId){for(let page=1;;page++){const users=ok(await service.auth.admin.listUsers({page,perPage:1000}),'discover interrupted own Auth creation').users;user=users.find(x=>x.email===email&&x.app_metadata?.synthetic_test_run_id===state.runId);if(user){state.userId=user.id;break;}if(users.length<1000)break;}}
 if(user)assert.ok(user.email===email&&user.app_metadata?.synthetic_test_run_id===state.runId,'Refuse to remove an unrelated Auth identity');
 if(state.userId){
  const row=ok(await service.from('students').select('id,email,auth_user_id').eq('auth_user_id',state.userId).maybeSingle(),'discover own profile');
  if(row){assert.equal(row.email,email);const flag=ok(await service.from('student_test_accounts').select('run_id').eq('student_id',row.id).single(),'verify trusted own manifest');assert.equal(flag.run_id,state.runId);
   ok(await service.from('students').delete().eq('id',row.id).eq('auth_user_id',state.userId).eq('email',email),'remove own profile before Auth');
   assert.equal(ok(await service.from('students').select('id').eq('id',row.id).maybeSingle(),'confirm profile cleanup'),null);
  }
  if(user)ok(await service.auth.admin.deleteUser(state.userId),'remove own Auth identity');
  const absent=await service.auth.admin.getUserById(state.userId);assert.equal(absent.error?.status,404);
  if(state.studentId){assert.equal(ok(await service.from('students').select('id').eq('id',state.studentId).maybeSingle(),'confirm manifest profile absent'),null);assert.equal(ok(await service.from('student_test_accounts').select('student_id').eq('student_id',state.studentId),'confirm classification absent').length,0);}
 }
 if(existsSync(file))unlinkSync(file);console.log('PASS own profile, classification and Auth identity cleaned and read back');
}
if(cleanupOnly>=0){await cleanup();}else{
 save();try{
  const created=ok(await service.auth.admin.createUser({email,password:randomUUID()+'Aa1!',email_confirm:true,app_metadata:{synthetic_test_run_id:state.runId},user_metadata:{full_name:'Recovery Fixture',phone:'+32470123456'}}),'create trusted local recovery account').user;state.userId=created.id;save();
  let profile=ok(await service.from('students').select('id').eq('auth_user_id',created.id).maybeSingle(),'find automatic profile');
  if(!profile)profile=ok(await service.from('students').insert({auth_user_id:created.id,email,name:'Recovery Fixture',phone:'+32470123456'}).select('id').single(),'bootstrap own complete profile');state.studentId=profile.id;save();
  assert.equal(ok(await service.from('student_test_accounts').select('run_id').eq('student_id',profile.id).single(),'read automatic classification').run_id,state.runId);
  assert.equal(ok(await service.from('student_directory').select('id').eq('id',profile.id),'read filtered directory').length,0);
  assert.equal(ok(await service.rpc('automation_email_allowed',{p_auth_user_id:created.id}),'check automation exclusion'),false);
  console.log('PASS marker exists before effects; directory and automation exclude the test account');
  if(process.argv.includes('--simulate-failure'))throw new Error('SIMULATED_ABORT');
  const link=ok(await service.auth.admin.generateLink({type:'recovery',email}),'generate local recovery token');
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=ok(await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'recovery'}),'verify local recovery token');assert.equal(verified.user.id,created.id);
  console.log('PASS actual Auth recovery link/OTP roundtrip without SMTP or password change');
  ok(await service.auth.admin.deleteUser(created.id),'simulate historical Auth-only cleanup');
  assert.ok(ok(await service.from('students').select('id').eq('id',profile.id).maybeSingle(),'verify historical orphan case'));
  assert.equal(ok(await service.from('student_directory').select('id').eq('id',profile.id),'verify orphan exclusion').length,0);
  console.log('PASS orphan profile remains excluded after Auth-only cleanup');
 }catch(error){if(process.argv.includes('--simulate-failure')&&error.message==='SIMULATED_ABORT')console.log('PASS injected failure is followed by the same verified cleanup');else throw error;
 }finally{await cleanup();}
}
