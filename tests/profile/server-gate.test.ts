import assert from "node:assert/strict";import test from "node:test";import {readFileSync} from "node:fs";import {runInNewContext} from "node:vm";import ts from "typescript";import * as profile from "../../lib/profile";

function load(path:string,deps:Record<string,unknown>){const mod={exports:{} as Record<string,(...args:any[])=>Promise<any>>};runInNewContext(ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,module:mod,console,process:{env:{NODE_ENV:"production"}},require:(n:string)=>{assert.ok(n in deps,n);return deps[n];}});return mod.exports;}
function reader(student:Record<string,unknown>|null,metadata={},repairError:unknown=null){let repairs=0;const user={id:"owner",email:"synthetic@example.invalid",user_metadata:metadata};const db={auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:student,error:null})})})}),rpc:async()=>{repairs++;return{data:[{...student,name:"Élodie",phone:"+32470123456"}],error:repairError};}};const deps={react:{cache:(fn:unknown)=>fn},"next/headers":{headers:async()=>new Headers({"x-htp-return-to":"/modules/intro?lesson=2"})},"next/navigation":{redirect:(url:string)=>{throw new Error("REDIRECT "+url);}},"@/lib/supabase/server":{createClient:async()=>db},"@/lib/profile":profile,"@/lib/logger":{logError:()=>{}}};return{module:load("lib/students.ts",deps),repairs:()=>repairs};}

test("normal student readers and server-action bootstrap cannot bypass incomplete profile",async()=>{
 const r=reader({id:"student",name:"Onbekend",phone:null});
 for(const fn of ["getCurrentStudent","ensureCurrentStudent"])await assert.rejects(r.module[fn](),/REDIRECT \/profile-completion\?next=%2Fmodules%2Fintro%3Flesson%3D2/);
 assert.equal((await r.module.getStudentForProfileCompletion()).student.name,"Onbekend");
});
test("existing metadata repairs only the current owner before completeness is assessed",async()=>{
 const r=reader({id:"student",name:"Onbekend",phone:null},{full_name:"Élodie",phone:"+32470123456"});
 assert.equal((await r.module.getCurrentStudent()).student.name,"Élodie");assert.equal(r.repairs(),1);
 const existing=reader({id:"student",name:"Chosen name",phone:"+32470123456"},{full_name:"Other"});
 assert.equal((await existing.module.getCurrentStudent()).student.name,"Chosen name");assert.equal(existing.repairs(),0);
});
test("failed optional repair keeps manual completion available without exposing content or a login loop",async()=>{
 const r=reader({name:"Onbekend",phone:null},{full_name:"Élodie"},{code:"PGRST202"});
 const form=await r.module.getStudentForProfileCompletion();assert.equal(form.student.name,"Onbekend");assert.equal(form.error,null);
 await assert.rejects(r.module.getCurrentStudent(),/REDIRECT \/profile-completion/);
});

test("profile save validates before RPC and uses no target ID or submitted access level",async()=>{
 let args:unknown;const deps={"next/cache":{revalidatePath:()=>{}},"next/navigation":{redirect:(path:string)=>{throw new Error("REDIRECT "+path);}},"@/lib/students":{getStudentForProfileCompletion:async()=>({student:{id:"owner"},error:null})},"@/lib/supabase/server":{createClient:async()=>({rpc:async(_name:string,input:unknown)=>{args=input;return{data:[{id:"owner"}],error:null};}})},"@/lib/logger":{logError:()=>{}},"@/lib/profile":profile};
 const action=load("app/actions/profile.ts",deps).completeOwnProfile;const form=new FormData();form.set("name","Onbekend");form.set("phone","0470 12 34 56");assert.ok((await action(form)).error);assert.equal(args,undefined);
 form.set("name","Élodie");form.set("student_id","victim");form.set("access_level","3");form.set("next","//evil.example");await assert.rejects(action(form),/REDIRECT \/dashboard/);assert.deepEqual(JSON.parse(JSON.stringify(args)),{p_name:"Élodie",p_phone:"+32470123456"});
});
