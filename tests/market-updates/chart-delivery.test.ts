import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canStudentAccessWeeklyUpdate } from "../../lib/weekly-update-access";
function route(student: {id:string;access_level:number}|null, update: Record<string,unknown>|null, subscribed=false) {
 let downloads=0;
 class Response { status:number;headers:unknown;constructor(public body:unknown,options:{status?:number;headers?:unknown}={}){this.status=options.status??200;this.headers=options.headers;} }
 const query:any={}; for(const key of ["select","eq"])query[key]=()=>query; query.maybeSingle=async()=>({data:update});
 const dependencies:Record<string,unknown>={"next/server":{NextResponse:Response},"@/lib/students":{getCurrentStudent:async()=>({student})},"@/lib/billing":{getBillingOverview:async()=>({}),canAccessSubscriberContent:()=>subscribed},"@/lib/weekly-update-access":{canStudentAccessWeeklyUpdate},"@/lib/supabase/service":{createServiceClient:()=>({from:()=>query,storage:{from:()=>({download:async()=>{downloads++;return{data:{type:"image/png"}};}})}})}};
 const exports:any={};const compiled=ts.transpileModule(readFileSync("app/api/market-updates/[id]/images/[index]/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
 runInNewContext(compiled.outputText,{exports,Number,require:(name:string)=>{assert.ok(name in dependencies,name);return dependencies[name];}});
 return {get:()=>exports.GET({}, {params:Promise.resolve({id:"1",index:"0"})}),downloads:()=>downloads};
}
const free={id:"free",access_level:1},academy={id:"academy",access_level:2};
const chart={image_paths:["weekly-updates/1/chart.png"],is_published:true,content_format:"chart",access_tier:"free"};
test("chart delivery permits a published free chart and keeps its response private",async()=>{const r=route(free,chart);const response=await r.get();assert.equal(response.status,200);assert.equal(response.headers["Cache-Control"],"private, no-store, max-age=0");assert.equal(r.downloads(),1);});
test("chart parent gates run before downloading protected assets",async()=>{
 for(const [student,item,subscribed,status] of [[null,chart,false,401],[free,{...chart,access_tier:"subscription"},false,403],[free,{...chart,is_published:false},false,404],[free,null,false,404],[academy,{...chart,image_paths:["other/path.png"]},true,404]] as const){const r=route(student,item,subscribed);assert.equal((await r.get()).status,status);assert.equal(r.downloads(),0);}
});
test("Academy and subscribed viewers retain chart access while an admin can inspect drafts",async()=>{
 for(const [student,subscribed,item]of[[academy,true,{...chart,access_tier:"subscription"}],[free,true,{...chart,access_tier:"subscription"}],[{id:"admin",access_level:3},true,{...chart,is_published:false}]]as const){const r=route(student,item,subscribed);assert.equal((await r.get()).status,200);assert.equal(r.downloads(),1);}
});
