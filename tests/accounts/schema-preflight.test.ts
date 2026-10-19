import assert from 'node:assert/strict';import test from 'node:test';import{verifyTestAccountSchema}from'../../scripts/verify-test-account-schema.mjs';
test('synthetic-account schema preflight rejects missing directory or eligibility functions',async()=>{
 const base={from:()=>({select:()=>({limit:async()=>({error:null})})}),rpc:async()=>({data:false,error:null})};await verifyTestAccountSchema(base);
 await assert.rejects(verifyTestAccountSchema({...base,from:()=>({select:()=>({limit:async()=>({error:{code:'42P01'}})})})}),/42P01/);
 await assert.rejects(verifyTestAccountSchema({...base,rpc:async()=>({error:{code:'PGRST202'}})}),/PGRST202/);
 await assert.rejects(verifyTestAccountSchema({...base,rpc:async()=>({data:true,error:null})}),/unexpected eligibility/);
});
