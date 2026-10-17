/** Local F3b acceptance. Requires synthetic fixture accounts and a loopback Supabase target. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const req=createRequire(import.meta.url),{chromium}=req('playwright'),{createClient}=req('@supabase/supabase-js');
const base=process.env.HTP_F3B_BASE_URL??'http://127.0.0.1:3118';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const keys=Object.fromEntries([...readFileSync(process.env.LOCAL_SUPABASE_ENV_FILE,'utf8').matchAll(/^([A-Z_]+)="([^"\n]*)"$/gm)].map(x=>[x[1],x[2]]));assert.equal(new URL(keys.API_URL).hostname,'127.0.0.1');
const accounts=JSON.parse(readFileSync(process.env.HTP_F2_FIXTURE_FILE)),fixtures=JSON.parse(readFileSync(process.env.HTP_F3B_FIXTURE_FILE));for(const user of accounts.users)assert.ok(user.email.endsWith('@example.invalid'));
assert.ok(fixtures.updates.every(x=>x.slug.startsWith('f3b-')));
const out=process.env.HTP_F3B_OUTPUT??'output/playwright/htp-f3b';mkdirSync(out,{recursive:true});mkdirSync(out+'/visual',{recursive:true});
const db=createClient(keys.API_URL,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),results={environment:{base,api:'loopback Supabase',browser:'installed Chrome',billing:'dormant',activeProvider:'Mux',providerWrites:false},behavior:[],visual:[],errors:[]};
const browser=await chromium.launch({channel:'chrome'});const contexts=[];
async function context(role='student',width=1440,theme='dark',mobile=false){const c=await browser.newContext({viewport:{width,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});contexts.push(c);await c.addCookies(accounts.users.find(x=>x.role===role).cookies);await c.addInitScript(t=>{try{localStorage.setItem('htp-theme',t);}catch{}},theme);await c.route(/https:\/\//,r=>{const u=new URL(r.request().url());return u.hostname.endsWith('.mux.com')&&['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort();});c.on('page',p=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>results.errors.push(e.message));});return c;}
if(['mobile','admin'].includes(process.env.HTP_F3B_RESUME)){const previous=JSON.parse(readFileSync(out+'/browser-results.json'));results.behavior=previous.behavior.filter((x,i,a)=>a.findIndex(y=>y.test===x.test)===i);results.environment.resumedBrowserEvidence=true;}
const record=(test,details={})=>{if(!results.behavior.some(x=>x.test===test))results.behavior.push({test,...details});writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2));console.log('PASS '+test);};
async function row(id){const r=await db.from('weekly_updates').select('*').eq('id',id).single();assert.equal(r.error,null);return r.data;}
async function goto(p,path){await p.goto(base+path);await p.locator('main').waitFor();await p.waitForFunction(()=>!document.querySelector('[hidden][id^="S:"]'));}
async function seekReady(p,time){await p.waitForFunction(t=>{const player=document.querySelector('mux-player');return player&&player.readyState>0&&Math.abs(player.currentTime-t)<3;},time,{timeout:30000});}
try {
 if(process.env.HTP_F3B_VISUAL_ONLY!=='1'){
 if(!['mobile','admin'].includes(process.env.HTP_F3B_RESUME)){
 const free=await context('free'),f=await free.newPage();await goto(f,'/market-analysis');const {data:freeRows,error:freeError}=await db.from('weekly_updates').select('id,markets').eq('is_published',true).eq('access_tier','free').neq('type','live_session');assert.equal(freeError,null);const freeMarkets=new Set(freeRows.flatMap(x=>x.markets));assert.equal(await f.getByRole('navigation',{name:'Filter op markt',exact:true}).count(),freeMarkets.size>=2?1:0);assert.equal(await f.getByRole('region',{name:'Weekvooruitblik',exact:true}).count(),0);assert.equal(await f.locator('[data-update-id]').count(),freeRows.length);assert.equal(await f.getByText('F3b geheim concept',{exact:true}).count(),0);await goto(f,'/market-analysis/f3a-multi-markt-mux-proef');assert.equal(await f.locator('mux-player').count(),0);record('free: chips match accessible markets; no paid hero, candidates or player');await free.close();
 const c=await context(),p=await c.newPage();await goto(p,'/market-analysis');
 const hero=p.getByRole('region',{name:'Weekvooruitblik',exact:true});await hero.waitFor();assert.equal(await p.locator('[data-update-id="20"]').count(),0);assert.equal(await hero.locator('a[href$="?t=20"]').count(),1);assert.equal(await p.getByText('F3b geheim concept',{exact:true}).count(),0);assert.ok(await p.locator('[data-update-id]').count()>5);
 for(const card of await p.locator('a[data-update-id]').all()){assert.equal(await card.locator('a,button,input,select,[tabindex]').count(),0);const summary=card.locator('p').filter({hasText:/./}).first();assert.ok(await summary.count());}
 const main=p.locator('main');assert.equal(await main.locator('h2').filter({hasText:/\d+ berichten/}).count(),0);record('real hero, explicit market timestamps, no duplicate card/drafts/count, one card link');
 await p.getByRole('searchbox',{name:'Zoeken'}).fill('F3b: waarom');await p.getByRole('heading',{name:/F3b: waarom/}).waitFor();assert.equal(await p.locator('[data-update-id]').count(),1);await p.getByText('Je bent bij met deze selectie.',{exact:false}).waitFor();assert.equal(await hero.count(),0);
 await p.getByRole('searchbox',{name:'Zoeken'}).fill('zzzz-geen-resultaat');await p.getByRole('heading',{name:'Geen updates gevonden'}).waitFor();await p.getByRole('button',{name:'Toon alle updates',exact:true}).last().click();await hero.waitFor();
 await p.getByRole('combobox',{name:'Inhoud',exact:true}).selectOption('video');assert.equal(await hero.count(),0);assert.equal(await p.getByRole('heading',{name:/F3b: waarom/}).count(),0);
 await p.getByRole('combobox',{name:'Inhoud',exact:true}).selectOption('text');assert.equal(await p.getByRole('heading',{name:'F3a multi-markt Mux-proef',exact:true}).count(),0);
 await p.getByRole('combobox',{name:'Inhoud',exact:true}).selectOption('all');await p.getByRole('navigation',{name:'Filter op markt',exact:true}).getByRole('button',{name:'Crypto',exact:true}).click();assert.equal(await hero.count(),0);await p.getByRole('navigation',{name:'Filter op markt',exact:true}).getByRole('button',{name:'Goud',exact:true}).click();await hero.waitFor();
 await p.getByRole('button',{name:'Open setups',exact:true}).click();assert.equal(await hero.count(),0);await p.getByRole('combobox',{name:'Setupstatus',exact:true}).waitFor();await p.getByRole('button',{name:'Archief',exact:true}).click();assert.equal(await p.getByRole('combobox',{name:'Setupstatus',exact:true}).count(),0);record('combined market/content/search; empty/reset, one-result continuation, preserved tabs');
 await goto(p,'/market-analysis');const article=p.getByRole('link',{name:/F3b: waarom/});await article.focus();await p.keyboard.press('Enter');await p.waitForURL('**/market-analysis/f3b-artikel-context');await p.getByRole('list',{name:'Artikelcontext'}).getByText('Goud en forex',{exact:true}).waitFor();await p.getByRole('heading',{name:'Wat is er gebeurd?',exact:true}).waitFor();assert.equal(await p.getByRole('heading',{name:'Samenvatting',exact:true}).count(),0);
 const takeaways=p.locator('.market-post-text-section').filter({has:p.getByRole('heading',{name:'Key takeaways',exact:true})}).locator('ol');assert.deepEqual(await takeaways.locator('li').allTextContents(),['Behoud de eerste afweging.','Houd rekening met het alternatieve scenario.','1.25% is een financiële waarde.','2026. Houd de jaarwaarde intact.']);
 const following=p.getByRole('region',{name:'Lees en kijk verder'});assert.equal(await following.locator('[data-update-id]').count(),2);assert.equal(await following.locator('a[href$="f3b-artikel-context"]').count(),0);assert.equal(await following.getByText('F3b geheim concept',{exact:true}).count(),0);
 assert.ok(await p.locator('.market-post-footer').evaluate(el=>{const reaction=el.querySelector('button'),section=el.querySelector('section'),disclaimer=el.querySelector('.market-post-disclaimer');return !!(reaction.compareDocumentPosition(section)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(section.compareDocumentPosition(disclaimer)&Node.DOCUMENT_POSITION_FOLLOWING);}));record('keyboard card navigation; context sections, semantic numbering and following before disclaimer');
 await goto(p,'/market-analysis/f3b-geen-context');assert.equal(await p.getByRole('list',{name:'Artikelcontext'}).count(),0);assert.equal(await p.getByRole('heading',{name:/Samenvatting|Wat is er gebeurd\?|Key takeaways/}).count(),0);
 await goto(p,'/market-analysis/f3b-afkorting');assert.equal(await p.getByRole('list',{name:'Artikelcontext'}).locator('li').count(),2);assert.equal(await p.getByRole('heading',{name:'Samenvatting',exact:true}).count(),0);record('empty and abbreviation editorial fallbacks');
 await goto(p,'/market-analysis/f3a-multi-markt-mux-proef?t=10');await seekReady(p,10);const mux=p.locator('mux-player');
 for(const [name,time] of [['Forex',10],['Goud',20],['Goud',20],['Introductie',0]]){const button=p.getByRole('button',{name:new RegExp(`Ga naar ${name} op`)});await button.click();await seekReady(p,time);assert.equal(await mux.evaluate(x=>x.paused),false);await p.waitForFunction(name=>[...document.querySelectorAll('button[aria-current="true"]')].some(x=>x.textContent.includes(name)),name);}
 await mux.evaluate(x=>{x.pause();x.currentTime=30;});await p.waitForFunction(()=>[...document.querySelectorAll('button[aria-current="true"]')].some(x=>x.textContent.includes('Goud')));
 const rail=p.locator('aside').filter({has:p.getByRole('heading',{name:'In deze video',exact:true})});assert.equal(await rail.evaluate(x=>getComputedStyle(x).position),'sticky');
 await mux.evaluate(x=>{x.play=()=>Promise.reject(new DOMException('Synthetic autoplay restriction','NotAllowedError'));});await p.getByRole('button',{name:/Ga naar Forex op/}).click();await p.getByText('Het tijdstip staat klaar. Druk op afspelen om verder te kijken.',{exact:true}).waitFor();record('real Mux seeks, repeated chapter, actual timeupdate active state, sticky rail, injected autoplay denial');
 await goto(p,'/updates/watch/f3a-multi-markt-mux-proef?t=00:20');await seekReady(p,20);
 for(const value of ['-1','999999']){await goto(p,'/market-analysis/f3a-multi-markt-mux-proef?t='+value);await p.getByText(value==='-1'?'Dit tijdstip is ongeldig. Kies een hoofdstuk of speel vanaf het begin.':'Dit tijdstip valt buiten de video. Kies een hoofdstuk of speel vanaf het begin.',{exact:true}).waitFor();await p.locator('mux-player').waitFor();}record('timestamp URL, legacy alias, invalid/out-of-duration fallback');await c.close();
 }
 if(process.env.HTP_F3B_RESUME!=='admin'){
 const mobile=await context('student',375,'dark',true),mp=await mobile.newPage();await goto(mp,'/market-analysis/f3a-multi-markt-mux-proef');const details=mp.locator('details').filter({has:mp.locator('summary').filter({hasText:'In deze video'})});assert.equal(await details.getAttribute('open'),null);await details.locator('summary').focus();await mp.keyboard.press('Enter');await details.getByRole('button',{name:/Ga naar Goud op/}).click();await seekReady(mp,20);await mp.waitForFunction(()=>[...document.querySelectorAll('details button[aria-current="true"]')].some(x=>x.textContent.includes('Goud')));assert.ok(await details.evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('mux-player').getBoundingClientRect().bottom));record('mobile collapsed chapters directly under video, keyboard expansion and actual Mux seeking');await mobile.close();
 }
 const admin=await context('admin'),ap=await admin.newPage();const fixture=fixtures.updates.find(x=>x.slug==='f3b-artikel-context');const before=await row(fixture.id);await goto(ap,'/admin/market-analysis?update='+fixture.id);await ap.getByRole('button',{name:'Marktupdate opslaan',exact:true}).waitFor();for(const name of ['summary','event_context','key_takeaways','title','intro'])assert.equal(await ap.locator(`[name="${name}"]`).count(),1);
 await ap.getByRole('button',{name:'Marktupdate opslaan',exact:true}).click();await ap.getByText('Marktupdate opgeslagen.',{exact:true}).waitFor();const after=await row(fixture.id);for(const key of ['body','article_html','intro','title','slug','published_at','published_by_student_id','published_by_display_name','markets','summary','event_context'])assert.deepEqual(after[key],before[key],key);assert.deepEqual(after.key_takeaways,before.key_takeaways.map(x=>x.replace(/^\d{1,3}[.)]\s+/,'')));
 await goto(ap,'/admin/market-analysis?update=18');await ap.getByRole('button',{name:'Marktupdate opslaan',exact:true}).waitFor();assert.equal(await ap.locator('[name="title"]').count(),1);assert.equal(await ap.locator('[name="summary"]').count(),1);const structuredBefore=await row(18);await ap.locator('[name="summary"]').fill('');await ap.getByRole('button',{name:'Marktupdate opslaan',exact:true}).click();await ap.getByText('Vul een kernboodschap in.',{exact:true}).first().waitFor();assert.deepEqual(await row(18),structuredBefore);for(const name of ['slug','access_tier','mentor_student_id'])assert.equal(await ap.locator(`[name="${name}"]`).count(),1);record('real admin form/action/SQL roundtrip preserves body, author, publication dates, legacy fields; structured core still required');await admin.close();
 }
 // One batched visual pass. Existing layout/theme tokens remain authoritative.
 for(const [size,width] of [['desktop',1440],['tablet',834],['mobile',375]])for(const theme of ['dark','light']){
  const c=await context('student',width,theme,size==='mobile'),p=await c.newPage();
  for(const [name,path] of [['feed','/market-analysis'],['video','/market-analysis/f3a-multi-markt-mux-proef'],['article','/market-analysis/f3b-artikel-context'],['dashboard','/dashboard']]){
   await goto(p,path);await p.locator('main h1').waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('main img')].filter(x=>{const r=x.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).every(x=>x.complete),null,{timeout:20000}).catch(()=>{});
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' '+size+' no page overflow');
   const cards=await p.locator('a[data-update-id]').evaluateAll(els=>els.map(el=>{const p=el.querySelector('p[class*="summary"]'),image=el.querySelector('[class*="media"]');return{width:el.getBoundingClientRect().width,image:image.getBoundingClientRect().width,compact:el.hasAttribute('data-compact'),summary:p?{height:p.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(p).lineHeight),clamp:getComputedStyle(p).webkitLineClamp}:null};}));
   for(const card of cards){assert.equal(card.summary?.clamp,'2');assert.ok(Math.abs(card.summary.height-card.summary.lineHeight*2)<2);if(width>=768&&!card.compact)assert.ok(card.image/card.width>=.40);}
   const filename=`${name}-${size}-${theme}.png`;await p.screenshot({path:out+'/visual/'+filename,fullPage:true});const contrast=await flatContrast(p);results.visual.push({name,size,theme,filename,cards:cards.length,noOverflow:true,contrast});writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2));console.log('VISUAL '+filename);
  }
  await c.close();
 }
 assert.deepEqual(results.errors,[]);writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2));console.log(`PASS ${results.behavior.length} browser groups, ${results.visual.length} visual combinations, no page errors`);
} finally { for(const c of contexts)await c.close().catch(()=>{});await browser.close();writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2)); }

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
