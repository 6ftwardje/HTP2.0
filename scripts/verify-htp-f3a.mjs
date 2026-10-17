/** Local F3a acceptance. Existing public Mux delivery is read-only; provider API/analytics writes are blocked. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const req=createRequire(import.meta.url),{chromium}=req('playwright'),{createClient}=req('@supabase/supabase-js');
const base=process.env.HTP_F3A_BASE_URL??'http://127.0.0.1:3118';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const keys=Object.fromEntries([...readFileSync(process.env.LOCAL_SUPABASE_ENV_FILE,'utf8').matchAll(/^([A-Z_]+)="([^"\n]*)"$/gm)].map(x=>[x[1],x[2]]));
assert.equal(new URL(keys.API_URL).hostname,'127.0.0.1');
const accounts=JSON.parse(readFileSync(process.env.HTP_F2_FIXTURE_FILE)),fixtures=JSON.parse(readFileSync(process.env.HTP_F3A_FIXTURE_FILE));
for(const u of accounts.users)assert.ok(u.email.endsWith('@example.invalid'));
const out=process.env.HTP_F3A_OUTPUT??'output/playwright/htp-f3a';mkdirSync(out,{recursive:true});
const db=createClient(keys.API_URL,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),results={environment:{base,browser:'installed Chrome',billing:'dormant',syntheticAccounts:true,activeProvider:'Mux',legacyProviders:'not active per Ward'},behavior:[],visual:[],provider:[],errors:[]};
async function getRow(id){const r=await db.from('weekly_updates').select('*').eq('id',id).single();assert.equal(r.error,null);return r.data;}
if(process.env.HTP_F3A_RESUME==='provider'){const previous=JSON.parse(readFileSync(`${out}/browser-results.json`));results.behavior=previous.behavior;results.environment.resumedContractEvidence=true;}
const browser=await chromium.launch({channel:'chrome'});
async function context(role,width=1440,theme='dark',mobile=false){const ctx=await browser.newContext({viewport:{width,height:1000},isMobile:mobile,hasTouch:mobile});ctx.on('page',p=>p.setDefaultTimeout(15000));await ctx.addCookies(accounts.users.find(x=>x.role===role).cookies);await ctx.addInitScript(t=>localStorage.setItem('htp-theme',t),theme);await ctx.route(/https:\/\//,route=>{const u=new URL(route.request().url());if((u.hostname.endsWith('.mux.com')&&['GET','HEAD','OPTIONS'].includes(route.request().method()))||u.hostname==='image.mux.com')return route.continue();return route.abort();});return ctx;}
const stable=row=>{const {updated_at,...rest}=row;return rest;};
try{
 // Actual browser form/action/SQL roundtrip for structured, historical and weekly content.
 if(process.env.HTP_F3A_RESUME!=='provider'){
 const admin=await context('admin');const p=await admin.newPage();
 for(const fixture of fixtures.updates){const before=await getRow(fixture.id);await p.goto(base+'/admin/market-analysis?update='+fixture.id);await p.getByRole('button',{name:'Marktupdate opslaan',exact:true}).waitFor();
  const checked=await p.locator('input[name="markets"]:checked').evaluateAll(xs=>xs.map(x=>x.value));assert.deepEqual(checked.sort(),[...before.markets].sort());
  if(before.type==='weekly_outlook'){
   for(const market of before.markets)await p.locator(`input[name="markets"][value="${market}"]`).uncheck();
   await p.getByRole('button',{name:'Marktupdate opslaan',exact:true}).click();await p.getByText('Kies minimaal één markt.',{exact:true}).first().waitFor();assert.deepEqual(await getRow(fixture.id),before);
   for(const market of before.markets)await p.locator(`input[name="markets"][value="${market}"]`).check();
   const chapters=p.locator('textarea[name="chapters"]');const valid=await chapters.inputValue();assert.match(valid,/Goud \| gold/);await chapters.fill('00:60 Ongeldig');await p.getByRole('button',{name:'Marktupdate opslaan',exact:true}).click();await p.getByText(/Hoofdstukregel 1 is ongeldig/).first().waitFor();assert.deepEqual(await getRow(fixture.id),before);await chapters.fill(valid);
  }
  await p.getByRole('button',{name:'Marktupdate opslaan',exact:true}).click();await p.getByText('Marktupdate opgeslagen.',{exact:true}).waitFor();const after=await getRow(fixture.id);assert.deepEqual(stable(after),stable(before));results.behavior.push({test:'real form/action/SQL roundtrip',kind:before.type,structured:!!before.update_structure,markets:after.markets,historyUnchanged:true,datesAuthorsUrlsUnchanged:true});
 }
 await admin.close();
 // Secondary tags must filter the existing member/admin views, without a feed redesign.
 for(const role of ['student','admin']){const c=await context(role),p=await c.newPage();await p.goto(base+(role==='admin'?'/admin/market-analysis':'/market-analysis'));
  const filter=role==='admin'?p.getByLabel('Categorie filteren'):p.getByLabel(/^Categorie/);
  for(const market of ['gold','trading','macro','indices','general']){await filter.selectOption(market);const target=market==='gold'||market==='trading'?'F3a multi-markt Mux-proef':'F3a historisch Macro en Indices';await p.getByRole('heading',{name:target,exact:true}).first().waitFor();results.behavior.push({test:'secondary/legacy market filter',role,market});}
  await c.close();
 }
 }
 if(process.env.HTP_F3A_CONTRACT_ONLY!=='1'){
 // Local real Mux capability evidence. Probe changes are not product feature implementation.
 for(const mobile of [false,true]){
  const c=await context('student',mobile?375:1440,'dark',mobile),p=await c.newPage();p.on('pageerror',e=>results.errors.push(e.message));await p.goto(base+'/market-analysis/f3a-multi-markt-mux-proef');const mux=p.locator('mux-player');await mux.waitFor();await p.waitForFunction(()=>document.querySelector('mux-player')?.readyState>0);
  await mux.evaluate(p=>{window.f3aEvents={};for(const e of ['timeupdate','seeked','ended','ratechange','play','pause'])p.addEventListener(e,()=>window.f3aEvents[e]=(window.f3aEvents[e]??0)+1);});
  console.log('Mux probe: '+(mobile?'mobile':'desktop'));
  const before=await mux.evaluate(p=>({duration:p.duration,poster:!!p.poster,pitch:p.media?.shadowRoot?.querySelector('video')?.preservesPitch}));
  await mux.getByRole('button',{name:'play',exact:true}).first().click();await p.waitForFunction(()=>document.querySelector('mux-player')?.currentTime>0);await mux.hover();
  const rateButton=mux.getByRole('button',{name:/Playback rate/});const speedVisible=await rateButton.isVisible();let defaultRates=[];
  if(speedVisible){await rateButton.click();defaultRates=await mux.getByRole('menuitemradio').allTextContents();await p.keyboard.press('Escape');}
  const rates=[];for(const rate of [0.5,0.75,1,1.25,1.5,2]){await mux.evaluate((p,rate)=>{p.playbackRate=rate;},rate);await p.waitForFunction(rate=>document.querySelector('mux-player')?.playbackRate===rate,rate);rates.push(await mux.evaluate(p=>({rate:p.playbackRate,pitch:p.media?.shadowRoot?.querySelector('video')?.preservesPitch})));}
  assert.ok(rates.every(x=>x.pitch===true));
  await mux.evaluate(p=>{p.playbackRate=1;p.pause();});
  for(const [name,time] of [['Ga naar Forex op 0:10',10],['Ga naar Goud op 0:20',20],['Ga naar Goud op 0:20',20],['Ga naar Introductie op 0:00',0]]){await p.getByRole('button',{name,exact:true}).click();await p.waitForFunction(t=>Math.abs(document.querySelector('mux-player').currentTime-t)<3,time);}
  await mux.evaluate(p=>{p.pause();p.currentTime=30;});await p.waitForFunction(()=>Math.abs(Number(document.querySelector('mux-player').mediaController.getAttribute('mediacurrenttime'))-30)<0.5);await mux.evaluate(p=>p.mediaController.focus());await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>Math.abs(document.querySelector('mux-player').currentTime-40)<2);await p.waitForFunction(()=>Math.abs(Number(document.querySelector('mux-player').mediaController.getAttribute('mediacurrenttime'))-40)<0.5);await p.keyboard.press('ArrowLeft');await p.waitForFunction(()=>Math.abs(document.querySelector('mux-player').currentTime-30)<2);
  await p.keyboard.press('m');await p.waitForFunction(()=>document.querySelector('mux-player').muted && document.querySelector('mux-player').mediaController.hasAttribute('mediamuted'));await p.keyboard.press('m');await p.waitForFunction(()=>!document.querySelector('mux-player').muted && !document.querySelector('mux-player').mediaController.hasAttribute('mediamuted'));
  await p.waitForFunction(()=>document.querySelector('mux-player').mediaController.hasAttribute('mediapaused'));await p.keyboard.press('Space');await p.waitForFunction(()=>!document.querySelector('mux-player').paused && !document.querySelector('mux-player').mediaController.hasAttribute('mediapaused'));await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('mux-player').paused && document.querySelector('mux-player').mediaController.hasAttribute('mediapaused'));
  await p.keyboard.press('f');await p.waitForFunction(()=>!!document.fullscreenElement && document.querySelector('mux-player').mediaController.hasAttribute('mediaisfullscreen'));await p.keyboard.press('f');await p.waitForFunction(()=>!document.fullscreenElement);
  const timeBefore=await mux.evaluate(p=>p.currentTime);await p.locator('body').evaluate(()=>{const input=document.createElement('input');input.id='f3a-keyboard-fixture';document.body.append(input);input.focus();});await p.keyboard.press('ArrowRight');await p.keyboard.press('Space');assert.equal(await mux.evaluate(p=>p.currentTime),timeBefore);assert.equal(await mux.evaluate(p=>p.paused),true);
  await mux.evaluate(p=>{p.currentTime=p.duration-0.5;p.play();});await p.waitForFunction(()=>window.f3aEvents.ended>0);const events=await p.evaluate(()=>window.f3aEvents);for(const e of ['timeupdate','seeked','ended','ratechange'])assert.ok(events[e]>0);
  console.log('Mux rates, chapters, keys, events: '+(mobile?'mobile':'desktop')+' passed');
  const accessible=await mux.ariaSnapshot();writeFileSync(`${out}/mux-${mobile?'mobile':'desktop'}-controls.txt`,accessible);
  const fresh=await context('student',mobile?375:1440,'dark',mobile),ap=await fresh.newPage();await ap.goto(base+'/market-analysis/f3a-multi-markt-mux-proef');await ap.locator('mux-player').waitFor();const autoplay=await ap.locator('mux-player').evaluate(async p=>{try{await p.play();p.pause();return 'allowed in this browser context';}catch(e){return e.name;}});await fresh.close();
  results.provider.push({test:'real account public Mux media',mobileEmulation:mobile,...before,autoplay,speedVisible,defaultRates,rates,events,chaptersSeekPlay:true,repeatedSeek:true,shortcutsWithinFocus:true,inputFocusUnaffected:true,fullscreen:true,probeOnly:true});await c.close();
 }
 // Access is still gated; private tags/media must not appear for the free fixture.
 const free=await context('free');const fp=await free.newPage();await fp.goto(base+'/market-analysis');assert.equal(await fp.getByRole('heading',{name:'F3a multi-markt Mux-proef',exact:true}).count(),0);await fp.goto(base+'/market-analysis/f3a-multi-markt-mux-proef');await fp.getByRole('heading',{name:'Deze inhoud is niet beschikbaar',exact:true}).waitFor();results.behavior.push({test:'free list and direct private content gate',pass:true});await free.close();
 // One bounded visual batch: changed views in both themes and all agreed widths.
 const surfaces=[['admin','/admin/market-analysis?update='+fixtures.updates[0].id,'structured-editor'],['admin','/admin/market-analysis?update='+fixtures.updates[2].id,'weekly-editor'],['student','/market-analysis?market=gold','member-filter'],['student','/market-analysis/f3a-multi-markt-mux-proef','detail']];
 for(const [role,path,name]of surfaces)for(const width of [1440,768,375])for(const theme of ['dark','light']){const c=await context(role,width,theme),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+path);await p.getByRole('main').waitFor();if(role==='admin')await p.getByRole('button',{name:'Marktupdate opslaan',exact:true}).waitFor();else if(name==='detail')await p.locator('mux-player').waitFor();await p.screenshot({path:`${out}/${name}-${width}-${theme}.png`,fullPage:true});const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);results.visual.push({name,width,theme,overflow,errors});assert.equal(overflow,false,`${name} ${width}`);assert.equal(errors.length,0);await c.close();}
 }
 assert.equal(results.errors.length,0);results.pass=true;
}catch(error){results.failure=error.message;throw error;}finally{writeFileSync(`${out}/${process.env.HTP_F3A_CONTRACT_ONLY==='1'?'contract-confirm-results':'browser-results'}.json`,JSON.stringify(results,null,2));await browser.close();}
console.log(`PASS F3a: ${results.behavior.length} behavior cases, ${results.provider.length} Mux device classes, ${results.visual.length} visual cases.`);
