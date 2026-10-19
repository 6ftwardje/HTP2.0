import{createClient}from'@supabase/supabase-js';
export async function verifyTestAccountSchema(db){
 const {error}=await db.from('student_directory').select('id').limit(0);if(error)throw new Error(`student_directory: ${error.code}`);
 for(const [name,args]of[['automation_email_allowed',{p_auth_user_id:'00000000-0000-0000-0000-000000000000'}],['test_account_chat_email_allowed',{p_job_id:'00000000-0000-0000-0000-000000000000'}]]){
  const{data,error}=await db.rpc(name,args);if(error||data!==false)throw new Error(`${name}: ${error?.code??'unexpected eligibility'}`);
 }
}
async function main(){const{NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key}=process.env;if(!url||!key)throw new Error('Test account schema check requires deployment configuration.');await verifyTestAccountSchema(createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));console.log('PASS: student directory and automation exclusions exist.');}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
