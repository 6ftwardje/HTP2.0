/** Local, synthetic F2 behavior verification. Never points at a remote database.
 * LOCAL_SUPABASE_ENV_FILE=/private/local.env HTP_F2_FIXTURE_FILE=/private/fixtures.json
 * node scripts/verify-htp-f2.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const req=createRequire(process.cwd()+"/package.json"),{chromium}=req("playwright"),{createClient}=req("@supabase/supabase-js");
const env=Object.fromEntries([...readFileSync(process.env.LOCAL_SUPABASE_ENV_FILE??"/tmp/htp-f2-local.env","utf8").matchAll(/^([A-Z_]+)="([^"\n]*)"$/gm)].map(m=>[m[1],m[2]]));
const fixtures=JSON.parse(readFileSync(process.env.HTP_F2_FIXTURE_FILE??"/tmp/htp-f2-fixtures.json","utf8"));
const base=process.env.HTP_F2_BASE_URL??"http://127.0.0.1:3118";
for(const url of[env.API_URL,base])assert.ok(["localhost","127.0.0.1","[::1]"].includes(new URL(url).hostname),"Localhost is required");
const u=fixtures.users.find(x=>x.role==="student"),other=fixtures.users.find(x=>x.role==="free");
assert.ok(u?.email.endsWith("@example.invalid")&&other?.email.endsWith("@example.invalid"),"Synthetic accounts only");
const db=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const own=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{assert.equal(r.error,null,JSON.stringify(r.error));return r.data};
ok(await own.auth.signInWithPassword({email:u.email,password:u.password}));
const out="output/playwright/htp-f2";mkdirSync(out,{recursive:true});
const results=[],eventIds=[],checks=(name,details={})=>{results.push({name,pass:true,...details});writeFileSync(out+"/behavior-results.json",JSON.stringify(results,null,2));console.log("PASS: "+name)};
const original=ok(await db.from("notification_recipients").select("id,read_at,archived_at").eq("student_id",u.studentId));
const b=await chromium.launch({channel:"chrome"}),ctx=await b.newContext({viewport:{width:1440,height:950}});await ctx.addCookies(u.cookies);
const p=await ctx.newPage();const pageErrors=[];p.on("pageerror",e=>pageErrors.push(e.message));
async function until(fn,label){for(let i=0;i<70;i++){if(await fn())return;await p.waitForTimeout(150)}throw Error("Timeout: "+label)}
const bell=page=>page.getByRole("banner").getByRole("button",{name:/ongelezen meldingen|Meldingen openen/});
const count=async(page=p)=>{const name=await bell(page).getAttribute("aria-label");return name==="Meldingen openen"?0:Number(name.split(" ")[0])};
const setRead=async(ids,value)=>ok(await db.from("notification_recipients").update({read_at:value}).in("id",ids));
try {
 if(original.length)ok(await db.from("notification_recipients").update({archived_at:new Date().toISOString()}).in("id",original.map(x=>x.id)));
 const created=ok(await db.from("notification_events").insert(Array.from({length:65},(_,i)=>({
  type:i%2?"subscription.payment_failed":"weekly_update.published",title:"F2 testmelding "+String(i+1).padStart(2,"0"),
  body:"Uitsluitend synthetische lokale verificatie-inhoud.",href:null,
  created_at:new Date(Date.now()-i*60000).toISOString(),
 }))).select("id,title"));
 eventIds.push(...created.map(x=>x.id));
 const rows=ok(await db.from("notification_recipients").insert(created.map((e,i)=>({
  event_id:e.id,student_id:u.studentId,created_at:new Date(Date.now()-i*60000).toISOString(),
 }))).select("id,event_id,created_at")).sort((a,z)=>Date.parse(z.created_at)-Date.parse(a.created_at));
 const ids=rows.map(x=>x.id);
 const shared=ok(await db.from("notification_recipients").insert({event_id:rows[0].event_id,student_id:other.studentId}).select("id").single());
 const staff=ok(await db.from("notification_events").insert({type:"student_intake.completed",title:"F2 staff-only overdelivery"}).select("id").single());eventIds.push(staff.id);
 ok(await db.from("notification_recipients").insert({event_id:staff.id,student_id:u.studentId}));
 await p.goto(base+"/notifications");await p.waitForLoadState("networkidle");
 await until(async()=>await count()===65,"65 visible notifications, no staff leak");
 assert.equal(await bell(p).locator("span").innerText(),"9+");
 const allIds=[];
 for(let page=1;page<=3;page++){
  if(page>1){await p.getByRole("link",{name:"Volgende pagina meldingen"}).click();await p.waitForURL("**/notifications?page="+page)}
  const visible=await p.locator("[data-notification-id]").evaluateAll(xs=>xs.map(x=>x.dataset.notificationId));allIds.push(...visible);
 }
 assert.equal(new Set(allIds).size,65);assert.equal(allIds.length,65);
 checks("65 visible deliveries paginate without gaps/duplicates; stale staff delivery stays hidden");
 await p.goto(base+"/notifications");
 for(const n of[0,1,9,10]){
  await setRead(ids,new Date().toISOString());if(n)await setRead(ids.slice(0,n),null);
  await until(async()=>await count()===n,"live badge "+n);
  assert.equal(await bell(p).locator("span").count(),n?1:0);
  if(n)assert.equal(await bell(p).locator("span").innerText(),n>9?"9+":String(n));
 }
 checks("0/1/9/10 badges update live, zero hides badge and ten caps at 9+");
 await bell(p).click();const dialog=p.getByRole("dialog",{name:"Meldingen",exact:true});await dialog.waitFor();
 assert.equal(await dialog.locator("[data-notification-id]").count(),5);
 assert.equal(ok(await db.from("notification_recipients").select("read_at").eq("id",ids[0]).single()).read_at,null);
 await p.keyboard.press("Escape");assert.equal(await bell(p).evaluate(e=>document.activeElement===e),true);
 await bell(p).click();await dialog.waitFor();await dialog.locator('[data-notification-id="'+ids[0]+'"]').getByRole("button",{name:/Melding verwijderen/}).click();
 await until(async()=>ok(await db.from("notification_recipients").select("archived_at").eq("id",ids[0]).single()).archived_at!==null,"delete persisted");
 assert.equal(new URL(p.url()).pathname,"/notifications");
 assert.equal(ok(await db.from("notification_recipients").select("archived_at").eq("id",shared.id).single()).archived_at,null);
 assert.ok(ok(await db.from("notification_events").select("id").eq("id",rows[0].event_id).maybeSingle()));
 checks("five-item preview does not mark read; Escape restores focus; delete keeps URL/event/other recipient");
 await p.keyboard.press("Escape");
 // Abort a real server-action transport once. Retry must leave the first attempt unread.
 let fail=true;
 await p.route("**/*",route=>{if(fail&&route.request().method()==="POST"&&route.request().headers()["next-action"]){fail=false;return route.abort("failed")}return route.continue()});
 const target=()=>p.locator('[data-notification-id="'+ids[1]+'"]').getByRole("button").first();
 await target().click();await p.getByRole("alert").filter({hasText:/niet gelukt/}).waitFor();
 assert.equal(ok(await db.from("notification_recipients").select("read_at").eq("id",ids[1]).single()).read_at,null);
 await target().click();await until(async()=>ok(await db.from("notification_recipients").select("read_at").eq("id",ids[1]).single()).read_at!==null,"retry persisted");
 await p.getByRole("status").filter({hasText:"geen gekoppelde inhoud"}).waitFor();await p.unroute("**/*");
 checks("failed read stays unread; retry succeeds; null href gives explicit feedback");
 // Include old unread history: bulk must cover more than the visible page and badge.
 await setRead(ids.slice(1),null);
 ok(await db.from("notification_recipients").update({created_at:new Date(Date.now()-31*86400000).toISOString()}).eq("id",ids[64]));
 await p.reload();await p.getByRole("button",{name:"Alles als gelezen markeren",exact:true}).click();
 await until(async()=>ok(await db.from("notification_recipients").select("id").in("id",ids).is("read_at",null).is("archived_at",null)).length===0,"full bulk read");
 await until(async()=>await count()===0,"bulk badge zero");
 checks("bulk read covers the full visible own set including >50 and older than 30 days");
 const p2=await ctx.newPage();await p2.goto(base+"/notifications");await p2.waitForLoadState("networkidle");
 const realtime=ok(await db.from("notification_events").insert({type:"subscription.bonus_expired",title:"F2 realtime test",body:"Synthetic local test"}).select("id").single());eventIds.push(realtime.id);
 const delivery=ok(await db.from("notification_recipients").insert({event_id:realtime.id,student_id:u.studentId}).select("id").single());
 await until(async()=>await count(p)===1&&await count(p2)===1,"two-tab realtime insert");
 await db.from("notification_recipients").update({read_at:new Date().toISOString()}).eq("id",delivery.id);
 await db.from("notification_recipients").update({read_at:new Date().toISOString()}).eq("id",delivery.id);
 await until(async()=>await count(p)===0&&await count(p2)===0,"duplicate realtime updates");
 assert.equal(await p2.evaluate(()=>performance.getEntriesByType("navigation").length),1);
 await ctx.setOffline(true);await db.from("notification_recipients").update({read_at:null}).eq("id",delivery.id);await ctx.setOffline(false);
 await until(async()=>await count(p2)===1,"online catch-up");
 checks("two tabs converge after insert, duplicate update and reconnect without document reload");
 await p2.close();
 // Empty means no visible deliveries, not merely no unread deliveries.
 ok(await db.from("notification_recipients").update({archived_at:new Date().toISOString()}).eq("student_id",u.studentId).in("event_id",eventIds));
 await p.reload();await p.getByText("Je bent helemaal mee.",{exact:true}).waitFor();assert.equal(await count(),0);
 checks("empty overview says Je bent helemaal mee and badge disappears");
 assert.deepEqual(pageErrors,[]);checks("no uncaught browser errors during behavior checks");
} finally {
 for(const row of original)ok(await db.from("notification_recipients").update({read_at:row.read_at,archived_at:row.archived_at}).eq("id",row.id));
 if(eventIds.length)ok(await db.from("notification_events").delete().in("id",eventIds));
 await b.close();
}
