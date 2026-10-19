import assert from 'node:assert/strict';import test from 'node:test';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';import ts from'typescript';import*as policy from'../../lib/video-position';
function route({signedIn=true,error=null,result={accepted:true,revision:1}}:{signedIn?:boolean;error?:{code:string;message?:string}|null;result?:Record<string,unknown>}={}){
 const calls:any[]=[],logs:any[]=[];const exports:any={};const dependencies:Record<string,unknown>={'@/lib/logger':{logError:(...args:unknown[])=>logs.push(args)},'next/server':{NextResponse:{json:(data:unknown,options:ResponseInit)=>new Response(JSON.stringify(data),options)}},'@/lib/students':{ensureCurrentStudent:async()=>({student:signedIn?{id:'owner'}:null})},'@/lib/video-position':policy,'@/lib/supabase/server':{createClient:async()=>({rpc:async(name:string,args:unknown)=>{calls.push({name,args});return{data:result,error};}})}};
 const code=ts.transpileModule(readFileSync('app/api/video-position/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 runInNewContext(code,{exports,URL,JSON,Number,require:(name:string)=>{assert.ok(name in dependencies,name);return dependencies[name];}});return{exports,calls,logs};
}
const body={kind:'update',id:42,viewerId:'owner',videoVersion:'mux:FixedPlayback',revision:0,sessionId:'f4000000-0000-4000-8000-000000000001',sequence:1,positionSeconds:30,durationSeconds:100};
const request=(value:unknown=body,origin='http://localhost')=>new Request('http://localhost/api/video-position',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});
test('position HTTP guards reject anonymous, cross-origin, malformed and account-switched requests before any RPC',async()=>{
 for(const [options,input,origin,status]of[[{signedIn:false},body,'http://localhost',401],[{},body,'http://evil.invalid',403],[{},{...body,viewerId:'other'},'http://localhost',403],[{},{...body,positionSeconds:-1},'http://localhost',400],[{},null,'http://localhost',400]]as const){const r=route(options);assert.equal((await r.exports.POST(request(input,origin))).status,status);assert.equal(r.calls.length,0);}
});
test('the write forwards the signed-in owner and exact CAS/session/version values, never uses a service client',async()=>{
 const r=route();const response=await r.exports.POST(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(r.calls[0].name,'save_video_position');assert.equal(r.calls[0].args.p_viewer_id,'owner');assert.equal(r.calls[0].args.p_expected_revision,0);assert.equal(r.calls[0].args.p_client_sequence,1);
});
test('conflict, revoked access, changed media and unavailable storage remain recoverable without exposing SQL errors',async()=>{
 for(const [code,status]of[['42501',403],['22023',422],['42P01',503]]as const){const r=route({error:{code,message:'private SQL detail'}});const response=await r.exports.POST(request());assert.equal(response.status,status);assert.ok(!(await response.text()).includes('private SQL detail'));assert.equal(r.logs[0][0],'market.video_position.failed');assert.equal(r.logs[0][1].code,code);assert.equal(r.logs[0][2].contentId,42);}
 const r=route({result:{accepted:false,conflict:true,revision:3}});assert.equal((await r.exports.POST(request())).status,409);
});
test('read requires a valid parent and authentication and returns only the guarded RPC result',async()=>{
 const anon=route({signedIn:false});assert.equal((await anon.exports.GET(new Request('http://localhost/api/video-position?kind=lesson&id=1'))).status,401);assert.equal(anon.calls.length,0);
 const r=route();assert.equal((await r.exports.GET(new Request('http://localhost/api/video-position?kind=bad&id=1'))).status,400);assert.equal(r.calls.length,0);assert.equal((await r.exports.GET(new Request('http://localhost/api/video-position?kind=update&id=42'))).status,200);assert.equal(r.calls[0].name,'read_video_position');
});

test('same-origin browser requests use the real Host when Next has an internal localhost URL',async()=>{
 const r=route();const request=new Request('http://localhost/api/video-position',{method:'POST',headers:{origin:'http://127.0.0.1:3118',host:'127.0.0.1:3118','content-type':'application/json'},body:JSON.stringify(body)});assert.equal((await r.exports.POST(request)).status,200);
});
