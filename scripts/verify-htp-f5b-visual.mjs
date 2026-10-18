/** One batched F5b layout/theme inspection, using completed synthetic fixtures. */
import assert from 'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{randomUUID}from'node:crypto';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=process.env.HTP_F5B_BASE_URL??'http://127.0.0.1:3118';assert.equal(new URL(base).hostname,'127.0.0.1');
const f=JSON.parse(readFileSync(process.env.HTP_F5A_FIXTURE_FILE)),ids=JSON.parse(readFileSync(process.env.HTP_F5B_RUNTIME_FILE??'/tmp/htp-f5b-runtime.json'));assert.ok(f.users.every(x=>x.email.endsWith('@example.invalid'))&&ids.rubricSlug==='f5b-local-test');
const out='output/playwright/htp-f5b';mkdirSync(out+'/visual',{recursive:true});const resume=process.env.HTP_F5B_VISUAL_RESUME==='1';const result=resume?JSON.parse(readFileSync(out+'/visual-results.json')):{cases:[],pageErrors:[]};const browser=await chromium.launch({channel:'chrome'}),contexts=[];
const who=role=>f.users.find(x=>x.role===role),reading='<h2>Synthetische HTP PDF-acceptatie</h2><p>Plan, risico en evaluatie. Geen echte marktgegevens.</p><p>Pagina 1 van 2. Pagina 2 van 2.</p><p>Deze twee tekstpagina’s bevatten uitsluitend synthetische testinhoud; de tweede pagina is liggend. Er zijn geen charts of tabellen.</p>';
async function context(role,width,theme){const c=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:width===375?2:1,isMobile:width===375,hasTouch:width===375,reducedMotion:'reduce',locale:'nl-BE'});contexts.push(c);await c.addCookies(who(role).cookies);await c.addInitScript(theme=>{try{localStorage.setItem('htp-theme',theme);}catch{}},theme);await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());c.on('page',p=>p.on('pageerror',e=>result.pageErrors.push(e.message)));return c;}
async function api(c,path,method='GET',data){const r=await c.request.fetch(base+path,{method,headers:method==='GET'?{}:{Origin:base},data});assert.equal(r.status(),200,await r.text());return r.json();}
async function goto(p,path){await p.goto(base+path);await p.locator('main').waitFor();await p.waitForFunction(()=>!document.querySelector('[hidden][id^="S:"]'));await p.evaluate(()=>document.fonts.ready);}
async function capture(p,surface,width,theme){if(result.cases.some(x=>x.surface===surface&&x.width===width&&x.theme===theme))return;await p.waitForTimeout(100);const overflow=await p.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth+1,main:[...document.querySelectorAll('main')].some(e=>e.scrollWidth>e.clientWidth+1)}));assert.deepEqual(overflow,{document:false,main:false});const contrast=await flatContrast(p);await p.screenshot({path:`${out}/visual/${surface}-${width}-${theme}.png`});result.cases.push({surface,width,theme,overflow,contrast});writeFileSync(out+'/visual-results.json',JSON.stringify(result,null,2));console.log('CAPTURE '+surface+' '+width+' '+theme);}
try{
 // Synthetically authored reading text is checked against the actual two-page source fixture.
 if(!resume){const a=await context('admin',1440,'dark');
 for(const id of [ids.course,ids.freeCourse,ids.toolboxPdf,ids.attached,ids.first,ids.paidAttachment]){const meta=await api(a,`/api/documents/${id}`);await api(a,`/api/admin/documents/${id}`,'PATCH',{version:meta.version,title:meta.title,accessibleHtml:reading,accessibleVerified:true,publish:true});}
 const course=await api(a,`/api/documents/${ids.course}`);const cover=await a.request.post(base+`/api/admin/documents/${ids.course}/cover`,{headers:{Origin:base},multipart:{version:course.version,file:{name:'synthetic-cover.webp',mimeType:'image/webp',buffer:readFileSync(out+'/synthetic-cover.webp')}}});assert.equal(cover.status(),200);await a.close();}
 for(const width of [1440,834,375])for(const theme of ['dark','light']){
  const required=['feed','detail','academy-pdf','toolbox','admin-pdf','admin-toolbox',...(theme==='dark'?['viewer']:[])];if(required.every(surface=>result.cases.some(x=>x.surface===surface&&x.width===width&&x.theme===theme)))continue;
  const student=await context('student',width,theme),p=await student.newPage();
  await goto(p,'/market-analysis');await p.getByRole('searchbox').fill('Synthetische F5b marktupdate');const card=p.locator(`article[data-update-id="${ids.update}"]`);await card.getByRole('button',{name:'Openen: Synthetische bijlage met cover',exact:true}).scrollIntoViewIfNeeded();await capture(p,'feed',width,theme);
  await goto(p,`/market-analysis/${ids.updateSlug}`);await p.getByRole('button',{name:'Openen: Synthetische bijlage zonder cover',exact:true}).first().scrollIntoViewIfNeeded();await capture(p,'detail',width,theme);
  await goto(p,'/academy/f5b-local-test?tab=pdf');await p.getByRole('button',{name:'Openen: '+ids.courseTitle,exact:true}).waitFor();if(width>=768)assert.equal(await p.getByRole('navigation',{name:'Hoofdnavigatie'}).getByRole('link',{name:'Academy',exact:true}).getAttribute('aria-current'),'page');await capture(p,'academy-pdf',width,theme);
  await p.getByRole('link',{name:'Toolbox',exact:true}).click();await p.waitForURL('**?tab=toolbox');await capture(p,'toolbox',width,theme);
  if(theme==='dark'){
   const meta=await api(student,`/api/documents/${ids.course}`),position=await api(student,`/api/documents/${ids.course}/position?version=${meta.version}`);await api(student,`/api/documents/${ids.course}/position`,'POST',{viewerId:who('student').studentId,version:meta.version,page:2,revision:position.revision,sessionId:randomUUID(),sequence:1});
   await goto(p,`/documents/${ids.course}`);await p.getByRole('button',{name:'Open document',exact:true}).click();await p.locator('dialog[open] canvas').first().waitFor();await p.waitForFunction(()=>document.querySelector('dialog[open]')?.dataset.rendering==='false'&&document.querySelector('dialog[open] input[aria-label="Paginanummer"]')?.value==='2');await capture(p,'viewer',width,theme);await p.keyboard.press('Escape');
  }
  await student.close();
  const admin=await context('admin',width,theme),ap=await admin.newPage();await goto(ap,'/admin/documents');await ap.locator('summary').filter({hasText:/^Synthetische Academy-rubriek/}).first().click();const summary=ap.locator('summary').filter({hasText:'Documenten: Synthetische F5b-module'}).first();await summary.click();const section=summary.locator('..');await section.getByRole('heading',{name:'PDF-bijlagen',exact:true}).scrollIntoViewIfNeeded();await capture(ap,'admin-pdf',width,theme);await section.getByRole('heading',{name:'Toolbox beheren',exact:true}).scrollIntoViewIfNeeded();await capture(ap,'admin-toolbox',width,theme);await admin.close();
 }
 assert.equal(result.cases.length,39);assert.deepEqual(result.pageErrors,[]);result.totalTextSamples=result.cases.reduce((n,x)=>n+x.contrast.sampleCount,0);result.contrastFailures=result.cases.flatMap(x=>x.contrast.failures.map(f=>({surface:x.surface,width:x.width,theme:x.theme,...f})));writeFileSync(out+'/visual-results.json',JSON.stringify(result,null,2));console.log('FINAL captures='+result.cases.length+' contrastSamples='+result.totalTextSamples+' failures='+result.contrastFailures.length);
}finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();}

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
