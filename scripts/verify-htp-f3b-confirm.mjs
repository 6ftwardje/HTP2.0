/** Local F3b acceptance. Requires synthetic fixture accounts and a loopback Supabase target. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const req=createRequire(import.meta.url),{chromium}=req('playwright'),{createClient}=req('@supabase/supabase-js');
const base=process.env.HTP_F3B_BASE_URL??'http://127.0.0.1:3118';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const keys=Object.fromEntries([...readFileSync(process.env.LOCAL_SUPABASE_ENV_FILE,'utf8').matchAll(/^([A-Z_]+)="([^"\n]*)"$/gm)].map(x=>[x[1],x[2]]));assert.equal(new URL(keys.API_URL).hostname,'127.0.0.1');
const accounts=JSON.parse(readFileSync(process.env.HTP_F2_FIXTURE_FILE)),fixtures=JSON.parse(readFileSync(process.env.HTP_F3B_FIXTURE_FILE));for(const user of accounts.users)assert.ok(user.email.endsWith('@example.invalid'));
assert.ok(fixtures.updates.every(x=>x.slug.startsWith('f3b-')));
const out=process.env.HTP_F3B_OUTPUT??'output/playwright/htp-f3b/confirm';mkdirSync(out,{recursive:true});mkdirSync(out+'/visual',{recursive:true});
const db=createClient(keys.API_URL,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),results={environment:{base,api:'loopback Supabase',browser:'installed Chrome',billing:'dormant',activeProvider:'Mux',providerWrites:false},behavior:[],visual:[],errors:[]};
const browser=await chromium.launch({channel:'chrome'});const contexts=[];
async function context(role='student',width=1440,theme='dark',mobile=false){const c=await browser.newContext({viewport:{width,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});contexts.push(c);await c.addCookies(accounts.users.find(x=>x.role===role).cookies);await c.addInitScript(t=>{try{localStorage.setItem('htp-theme',t);}catch{}},theme);await c.route(/https:\/\//,r=>{const u=new URL(r.request().url());return u.hostname.endsWith('.mux.com')&&['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort();});c.on('page',p=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>results.errors.push(e.message));});return c;}
if(false){const previous=JSON.parse(readFileSync(out+'/browser-results.json'));results.behavior=previous.behavior.filter((x,i,a)=>a.findIndex(y=>y.test===x.test)===i);results.environment.resumedBrowserEvidence=true;}
const record=(test,details={})=>{if(!results.behavior.some(x=>x.test===test))results.behavior.push({test,...details});writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2));console.log('PASS '+test);};
async function row(id){const r=await db.from('weekly_updates').select('*').eq('id',id).single();assert.equal(r.error,null);return r.data;}
async function goto(p,path){await p.goto(base+path);await p.locator('main').waitFor();await p.waitForFunction(()=>!document.querySelector('[hidden][id^="S:"]'));}
async function seekReady(p,time){await p.waitForFunction(t=>{const player=document.querySelector('mux-player');return player&&player.readyState>0&&Math.abs(player.currentTime-t)<3;},time,{timeout:30000});}
try {
 for(const [size,width] of [['desktop',1440],['tablet',834],['mobile',375]])for(const theme of ['dark','light']){
  const c=await context('student',width,theme,size==='mobile'),p=await c.newPage();
  await goto(p,'/market-analysis/f3a-multi-markt-mux-proef?t=20');await seekReady(p,20);
  const mux=p.locator('mux-player');await mux.evaluate(x=>x.pause());
  if(width<1280)await p.locator('details summary').filter({hasText:'In deze video'}).click();
  const chapter=p.getByRole('button',{name:/Ga naar Goud op/});await chapter.focus();
  await p.waitForFunction(()=>[...document.querySelectorAll('button[aria-current="true"]')].some(x=>x.textContent.includes('Goud')));
  const focus=await chapter.evaluate(el=>getComputedStyle(el).outlineWidth);assert.ok(parseFloat(focus)>=2);
  await p.screenshot({path:out+`/video-${size}-${theme}.png`,fullPage:true});
  const videoContrast=await flatContrast(p);
  await goto(p,'/market-analysis/f3b-artikel-context');
  const following=p.getByRole('region',{name:'Lees en kijk verder'});const cards=following.locator('[data-update-id]');assert.equal(await cards.count(),2);
  const boxes=await cards.evaluateAll(xs=>xs.map(x=>({x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y})));
  assert.ok(width<768?boxes[1].y>boxes[0].y:boxes[1].x>boxes[0].x);
  await p.setViewportSize({width,height:1600});await following.screenshot({path:out+`/following-${size}-${theme}.png`});
  const followingContrast=await flatContrast(p);assert.equal(videoContrast.failures.length+followingContrast.failures.length,0);
  results.visual.push({size,theme,readyMux:true,actualPosition:20,focus,followingCards:2,columns:width<768?1:2,videoContrast,followingContrast});
  if(size==='desktop'&&theme==='dark'){
   await goto(p,'/market-analysis');const article=p.getByRole('link',{name:/F3b: waarom/});await article.screenshot({path:out+'/feed-card-desktop.png'});
   const chart=p.getByRole('link',{name:'F3b: chart met context — synthetische proef',exact:true});await chart.scrollIntoViewIfNeeded();await p.waitForFunction(()=>[...document.querySelectorAll('a[data-update-id] img')].some(x=>x.src.includes('/api/market-updates')&&x.complete&&x.naturalWidth>0));assert.equal(await chart.locator('[class*="bg-gradient-to-t"]').count(),0);await chart.screenshot({path:out+'/chart-card.png'});record('real local chart delivery and text/chart filter composition');
   // Inject a network failure in a fresh context to exercise the shared image fallback.
   const failed=await context(),fp=await failed.newPage();await fp.route('**/_next/image?*',route=>route.abort());await goto(fp,'/market-analysis');const card=fp.getByRole('link',{name:'F3a multi-markt Mux-proef',exact:true});await card.scrollIntoViewIfNeeded();await fp.waitForFunction(()=>!document.querySelector('a[data-update-id="18"] img'));assert.ok(await card.locator('[class*="media"]').innerText());await card.screenshot({path:out+'/thumbnail-failure-fallback.png'});record('injected image failure uses the existing initial fallback instead of an indefinite shimmer');await failed.close();
  }
  await c.close();writeFileSync(out+'/confirm-results.json',JSON.stringify(results,null,2));console.log('CONFIRM '+size+' '+theme);
 }
 const free=await context('free'),fp=await free.newPage();const {data:freeChart}=await db.from('weekly_updates').select('id').eq('slug','f3b-chart-free').single();const {data:paidChart}=await db.from('weekly_updates').select('id').eq('slug','f3b-chart-context').single();
 await goto(fp,'/market-analysis');const freeCard=fp.getByRole('link',{name:'F3b: chart voor gratis toegang',exact:true});await freeCard.scrollIntoViewIfNeeded();await fp.waitForFunction(id=>{const img=document.querySelector(`a[data-update-id="${id}"] img`);return img?.complete&&img.naturalWidth>0;},freeChart.id);assert.equal((await fp.request.get(base+`/api/market-updates/${freeChart.id}/images/0`)).status(),200);assert.equal((await fp.request.get(base+`/api/market-updates/${paidChart.id}/images/0`)).status(),403);assert.equal(await fp.getByRole('link',{name:'F3b: chart met context — synthetische proef',exact:true}).count(),0);await free.close();
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+`/api/market-updates/${freeChart.id}/images/0`)).status(),401);await anonymous.close();record('free chart loads with browser session; paid chart 403, anonymous 401, no paid feed card');
 const admin=await context('admin'),p=await admin.newPage();for(const slug of ['f3b-artikel-context','f3b-chart-context']){const {data}=await db.from('weekly_updates').select('id').eq('slug',slug).single();await goto(p,'/admin/market-analysis?update='+data.id);await p.locator('[name="summary"]').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/editor-'+slug+'.png',fullPage:true});for(const name of ['summary','event_context','key_takeaways'])assert.equal(await p.locator(`[name="${name}"]`).count(),1);}await admin.close();
 assert.deepEqual(results.errors,[]);writeFileSync(out+'/confirm-results.json',JSON.stringify(results,null,2));console.log('PASS six final confirmations, real chart, image fallback and two editors');
} finally {for(const c of contexts)await c.close().catch(()=>{});await browser.close();}

async function flatContrast(page){return page.evaluate(()=>{
 const can=document.createElement('canvas');can.width=can.height=1;const cx=can.getContext('2d',{willReadFrequently:true});
 const rgba=v=>{cx.clearRect(0,0,1,1);cx.fillStyle=v;cx.fillRect(0,0,1,1);return [...cx.getImageData(0,0,1,1).data].map((x,i)=>i===3?x/255:x)};
 const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
 const bg=el=>{const a=rgba(getComputedStyle(el).backgroundColor);return a[3]===1?a.slice(0,3):blend(a,el.parentElement?bg(el.parentElement):[255,255,255])};
 const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const failures=[],samples=[];
 for(const el of document.querySelectorAll('.platform-surface *')){
  if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const s=getComputedStyle(el),r=el.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none')continue;
  if(el.closest('[disabled], [aria-disabled="true"], [aria-hidden="true"]'))continue;
  const background=bg(el),color=blend(rgba(s.color),background);let opacity=1;for(let p=el;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);
  if(opacity < 0.01) continue;
  const visible=color.map((c,i)=>c*opacity+background[i]*(1-opacity));
  const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700),cr=ratio(visible,background),min=large?3:4.5;
  const sample={text:el.textContent.trim().slice(0,65),tag:el.tagName,className:el.className,ratio:Math.round(cr*100)/100,min,color:s.color,background:s.backgroundColor};samples.push(sample);if(cr+0.01<min)failures.push(sample);
 }
 return {failures,sampleCount:samples.length,minRatio:Math.min(...samples.map(x=>x.ratio))};
});}
