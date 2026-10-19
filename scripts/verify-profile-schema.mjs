import {createClient} from '@supabase/supabase-js';

/** Read-only prerequisite. Neither function can write without an authenticated owner. */
export async function verifyProfileSchema(db) {
  for (const [name,args] of [['repair_own_student_profile',{}],['complete_own_student_profile',{p_name:'Schema check',p_phone:'+32470123456'}]]) {
    const {error,status}=await db.rpc(name,args);
    if(error?.code!=='42501')throw new Error(`${name}: expected an authentication denial, received HTTP ${status}, ${error?.code??'unexpected success'}`);
  }
}
async function main(){
 const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key}=process.env;
 if(!url||!key)throw new Error('Profile schema check requires deployment Supabase configuration.');
 await verifyProfileSchema(createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
 console.log('PASS: profile completion and repair functions exist and deny requests without an owner.');
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
