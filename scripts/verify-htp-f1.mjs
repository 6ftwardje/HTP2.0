/** Local F1 verification; requires seeded synthetic local accounts.
 * See docs/HTP-F1-VERIFICATIE.md. No production requests, schema writes or paid calls.
 * HTP_F1_FIXTURE_FILE=/private/local-fixtures.json node scripts/verify-htp-f1.mjs
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const req=createRequire(process.cwd()+'/package.json');const {chromium}=req('playwright');const {buildSync}=req('esbuild');
const fixtures=JSON.parse(readFileSync(process.env.HTP_F1_FIXTURE_FILE ?? '/tmp/htp-f1-fixtures.json','utf8'));const round=process.env.HTP_F1_ROUND??'after';const out=`output/playwright/htp-f1/${round}`;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});const rows=[],checks=[];const baseline=JSON.parse(readFileSync('output/playwright/htp-f1/before/results.json','utf8'));const base=process.env.HTP_F1_BASE_URL ?? 'http://127.0.0.1:3117';assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'F1 verification requires localhost');
const record=(name,condition,detail)=>{checks.push({name,pass:Boolean(condition),detail});writeFileSync(out+'/behavior-checks.json',JSON.stringify(checks,null,2));};
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
  if(el.closest('[disabled], [aria-hidden="true"]'))continue;
  const background=bg(el),color=blend(rgba(s.color),background);let opacity=1;for(let p=el;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);
  if(opacity < 0.01) continue;
  const visible=color.map((c,i)=>c*opacity+background[i]*(1-opacity));
  const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700),cr=ratio(visible,background),min=large?3:4.5;
  const sample={text:el.textContent.trim().slice(0,65),tag:el.tagName,className:el.className,ratio:Math.round(cr*100)/100,min,color:s.color,background:s.backgroundColor};samples.push(sample);if(cr+0.01<min)failures.push(sample);
 }
 return {failures,sampleCount:samples.length,minRatio:Math.min(...samples.map(x=>x.ratio))};
});}
for(const role of ['student','admin','free','mentor']){
 const u=fixtures.users.find(u=>u.role===role);
 for(const [size,width] of [['desktop',1440],['tablet',768],['mobile',375]])for(const theme of ['dark','light']){
  const ctx=await browser.newContext({viewport:{width,height:950},colorScheme:theme});await ctx.addCookies(u.cookies);await ctx.addInitScript(t=>localStorage.setItem('htp-theme',t),theme);const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const routes=role==='student'?['/dashboard','/market-analysis','/market-analysis/f1-update-1','/modules','/modules/f1-module-1','/notifications']:role==='admin'?['/dashboard','/admin','/admin/market-analysis']:['/dashboard','/modules'];
  for(const path of routes){
   const response=await page.goto(base+path,{waitUntil:'networkidle',timeout:60000});
   await page.addStyleTag({content:'nextjs-portal {display:none !important}'});
   if(role==='student'||role==='admin')await page.screenshot({path:`${out}/${role}-${path.replaceAll('/','_')}-${size}-${theme}.png`,fullPage:true});
   const data={role,size,theme,path,status:response?.status(),url:new URL(page.url()).pathname,title:await page.locator('h1').allTextContents(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors:[...errors],articleType:await page.locator('.market-post h1').evaluateAll(xs=>xs.map(x=>{const c=getComputedStyle(x);return {font:c.fontSize,lineHeight:c.lineHeight,weight:c.fontWeight}})),contrast:await flatContrast(page)};
   rows.push(data);const before=baseline.find(x=>x.role===role&&x.size===size&&x.theme===theme&&x.path===path);
   record(`route ${role} ${size} ${theme} ${path}`,data.status===200&&data.url===before.url&&!data.horizontalOverflow&&!data.errors.length,{status:data.status,url:data.url,errors:data.errors});
   if(data.articleType.length)record(`article type ${size} ${theme}`,JSON.stringify(data.articleType)===JSON.stringify(before.articleType),data.articleType);
  }
  await ctx.close();
 }
 console.log('Eindcontrole route-/beeldmatrix:',role,flush());
}
function flush(){writeFileSync(out+'/results.json',JSON.stringify({rows,checks},null,2));return '';}
// Browser behavior and state checks, all against the local application.
const user=fixtures.users.find(x=>x.role==='student');
for(const system of ['light','dark']){
 const ctx=await browser.newContext({viewport:{width:1440,height:950},colorScheme:system});await ctx.addCookies(user.cookies);const p=await ctx.newPage();await p.goto(base+'/dashboard',{waitUntil:'networkidle'});
 record(`dark fallback on ${system} system`,await p.locator('html').getAttribute('data-theme')==='dark');
 await p.getByRole('button',{name:'Lichte modus inschakelen',exact:true}).click();record('toggle light',await p.locator('html').getAttribute('data-theme')==='light');await p.reload({waitUntil:'networkidle'});record('stored light persists',await p.locator('html').getAttribute('data-theme')==='light');
 await p.getByRole('button',{name:'Donkere modus inschakelen',exact:true}).focus();record('theme focus visible',await p.getByRole('button',{name:'Donkere modus inschakelen',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle!=='none'));
 await p.getByRole('button',{name:'Donkere modus inschakelen',exact:true}).click();await p.reload({waitUntil:'networkidle'});record('stored dark persists',await p.locator('html').getAttribute('data-theme')==='dark');await ctx.close();
}
{
 const ctx=await browser.newContext({viewport:{width:1440,height:950}});await ctx.addCookies(user.cookies);await ctx.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}));const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/dashboard',{waitUntil:'networkidle'});record('denied storage defaults dark',await p.locator('html').getAttribute('data-theme')==='dark');await p.getByRole('button',{name:'Lichte modus inschakelen',exact:true}).click();record('denied storage still toggles',await p.locator('html').getAttribute('data-theme')==='light'&&errors.length===0,errors);await ctx.close();
}
{
 const ctx=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'});await ctx.addCookies(user.cookies);const p=await ctx.newPage();await p.goto(base+'/market-analysis',{waitUntil:'networkidle'});
 record('search retains function',await p.locator('input[type=search]').count()===1);await p.locator('input[type=search]').fill('Bitcoin');record('search filters existing fixture',await p.locator('article').count()===1);await p.locator('input[type=search]').fill('');
 const time=p.locator('article time').first();await time.focus();record('date exact tooltip keyboard',await time.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).visibility==='visible')&&/Brussel/.test(await time.getAttribute('title')));
 record('reduced motion tooltip',await time.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).transitionDuration==='0s'));
 // All six real shared tags rendered in an isolated component harness using the shipped component/CSS.
 const bodyClass=await p.locator('body').getAttribute('class');const styles=await p.locator('link[rel=stylesheet]').evaluateAll(xs=>xs.map(x=>x.href));const globalCss=(await Promise.all(styles.map(async url=>(await p.request.get(url)).text()))).join('\n');
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{MarketTag,MARKET_TAG_LABELS}from'${process.cwd()}/components/ui/MarketTag';createRoot(document.getElementById('demo')).render(<main className="platform-surface" style={{padding:32,background:'var(--card)',color:'var(--foreground)'}}><h1 className="cb-page-title">F1 componentcontrole</h1><div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:24}}>{Object.keys(MARKET_TAG_LABELS).map(m=><MarketTag key={m} market={m}/>)}</div></main>);`;
 buildSync({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'f1-demo.tsx',loader:'tsx'},bundle:true,format:'iife',jsx:'automatic',outfile:'/tmp/htp-f1-demo.js'});
 for(const theme of ['dark','light']){
  const demo=await ctx.newPage();demo.on('pageerror',e=>console.error('Component harness:',e.message));await demo.setContent(`<html data-theme="${theme}"><head><base href="${base}/"><style>${globalCss}\n${readFileSync('/tmp/htp-f1-demo.css','utf8')}</style></head><body class="${bodyClass}"><div id="demo"></div></body></html>`);await demo.addScriptTag({content:readFileSync('/tmp/htp-f1-demo.js','utf8')});await demo.locator('[data-market]').last().waitFor();const contrast=await flatContrast(demo);record(`six MarketTags AA ${theme}`,contrast.failures.length===0,contrast);await demo.screenshot({path:`${out}/market-tags-${theme}.png`});await demo.close();
 }
 await ctx.close();
}
{
 const ctx=await browser.newContext({viewport:{width:1440,height:950}});await ctx.addCookies(user.cookies);const p=await ctx.newPage();await p.goto(base+'/market-analysis/f1-update-1',{waitUntil:'networkidle'});
 record('article disclaimer preserved',await p.getByText('Deze analyse is educatief en geen financieel advies.',{exact:true}).count()===1);record('no comment editor introduced',await p.locator('textarea').count()===0);
 const before=await p.getByRole('button',{name:/Nuttig/}).getAttribute('aria-pressed');await p.getByRole('button',{name:/Nuttig/}).click();await p.waitForTimeout(500);record('existing reaction still works',(await p.getByRole('button',{name:/Nuttig/}).getAttribute('aria-pressed'))!==before);
 await p.goto(base+'/notifications',{waitUntil:'networkidle'});const readButton=p.getByRole('button',{name:'Gelezen',exact:true});if(await readButton.count()){await readButton.click();await readButton.waitFor({state:'hidden'});}record('existing notification read action',await readButton.count()===0);
 for(const path of ['/updates','/weekly-updates','/weekly-updates/f1-update-1','/updates/watch/f1-update-1']){await p.goto(base+path,{waitUntil:'networkidle'});record('legacy '+path,(await p.locator('h1').count())===1&&!p.url().includes('/login'));}
 await ctx.close();
}
for(const [size,width] of [['desktop',1440],['mobile',375]]){
 const ctx=await browser.newContext({viewport:{width,height:950}});const p=await ctx.newPage();await p.goto(base+'/login',{waitUntil:'networkidle'});await p.addStyleTag({content:'nextjs-portal {display:none !important}'});await p.screenshot({path:`${out}/login-${size}.png`,fullPage:true});record('login logo '+size,await p.getByRole('img',{name:'Het Trade Platform',exact:true}).count()>0&&!await p.locator('img[src*="logo-text"]').count());await ctx.close();
}
writeFileSync(out+'/results.json',JSON.stringify({rows,checks,contrastFailures:rows.flatMap(x=>x.contrast.failures.map(y=>({role:x.role,size:x.size,theme:x.theme,path:x.path,...y})))},null,2));
await browser.close();console.log('Routechecks:',rows.length,'gedragschecks:',checks.length,'mislukt:',checks.filter(x=>!x.pass).length,'contrastbevindingen:',rows.reduce((n,x)=>n+x.contrast.failures.length,0));
if(checks.some(x=>!x.pass)){console.log(JSON.stringify(checks.filter(x=>!x.pass),null,2));process.exitCode=1;}
