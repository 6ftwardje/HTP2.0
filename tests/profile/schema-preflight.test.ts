import assert from 'node:assert/strict';import test from 'node:test';
import {verifyProfileSchema} from '../../scripts/verify-profile-schema.mjs';
test('profile preflight accepts only real RPC authentication denials, never a missing schema',async()=>{
 const called:string[]=[];await verifyProfileSchema({rpc:async(name:string)=>{called.push(name);return{error:{code:'42501'},status:403};}});assert.deepEqual(called,['repair_own_student_profile','complete_own_student_profile']);
 for(const code of['PGRST202','PGRST301'])await assert.rejects(verifyProfileSchema({rpc:async()=>({error:{code},status:404})}),new RegExp(code));
 await assert.rejects(verifyProfileSchema({rpc:async()=>({error:null,status:200})}),/unexpected success/);
});
