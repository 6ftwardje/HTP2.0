/** Loopback-only HTP-25 measurements. No app authorization is exercised by this harness. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base='http://127.0.0.1:3120',out='output/playwright/htp-f5a';mkdirSync(out+'/visual',{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),results={synthetic:true,productionSecurityTest:false,cases:[],pageErrors:[]};
try{
 for(const width of [1440,834,375]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===375,deviceScaleFactor:width===375?3:1,reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>results.pageErrors.push(error.message));
  for(const name of ['large','one']){
   await page.goto(base+'/?case='+name);await page.getByRole('button',{name:'Open testdocument'}).click();await page.waitForFunction(()=>window.probe.ready,{},{timeout:60000});
   const sizes=[];
   for(const n of name==='large'?[1,60,120,1]:[1]){await page.evaluate(n=>window.probe.page(n),n);await page.waitForFunction(()=>window.probe.ready);const m=await page.evaluate(()=>window.probe.metrics());assert.equal(m.current,n);assert.ok(m.canvases<=3&&m.canvasBytes<=24000000,JSON.stringify(m));sizes.push(m);}
   for(let i=0;i<4;i++)await page.getByRole('button',{name:'Inzoomen',exact:true}).click();await page.waitForFunction(()=>window.probe.ready);const zoom=await page.evaluate(()=>window.probe.metrics());assert.equal(zoom.zoom,2);assert.ok(zoom.canvasBytes<=24000000);await page.getByRole('button',{name:'Passend',exact:true}).click();await page.waitForFunction(()=>window.probe.ready);
   await page.getByLabel('Leesweergave').selectOption('text');await page.waitForFunction(()=>window.probe.ready);await page.getByRole('region',{name:'Tekst van huidige pagina'}).getByText('Dit document bevat geen cursusinhoud',{exact:false}).waitFor();await page.getByLabel('Leesweergave').selectOption('canvas');await page.waitForFunction(()=>window.probe.ready);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const header=await page.locator('dialog header').boundingBox();assert.ok(header.y>=0&&header.y+header.height<=1000);await page.screenshot({path:`${out}/visual/${name}-${width}.png`,fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(x=>x.open),false);await page.getByRole('button',{name:'Open testdocument'}).evaluate(x=>{if(document.activeElement!==x)throw Error('Focus was not restored');});await page.waitForFunction(()=>!document.querySelector('dialog').open&&document.querySelectorAll('canvas').length===0);
   results.cases.push({name,width,sizes,zoom,focusRestored:true,extractedTextProbe:true});console.log('PASS '+name+' '+width);
  }
  await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>results.pageErrors.push(e.message));
 for(const name of ['broken','encrypted']){await page.goto(base+'/?case='+name);await page.getByRole('button',{name:'Open testdocument'}).click();await page.getByRole('alert').waitFor();assert.ok(await page.getByRole('alert').innerText());results.cases.push({name,error:await page.getByRole('alert').innerText()});console.log('PASS '+name);}
 const hashes=[];
 for(const viewer of ['a','b']){const response=await context.request.get(base+'/fixture?case=large&viewer='+viewer);assert.equal(response.status(),200);assert.equal(response.headers()['cache-control'],'private, no-store, max-age=0');const bytes=await response.body();writeFileSync(`${out}/${viewer}.pdf`,bytes);hashes.push(createHash('sha256').update(bytes).digest('hex'));
  const tool=process.env.HTP_PDFTOTEXT;assert.ok(tool,'Set HTP_PDFTOTEXT to the local Poppler pdftotext binary');execFileSync(tool,['-raw',`${out}/${viewer}.pdf`,`${out}/${viewer}.txt`]);const text=readFileSync(`${out}/${viewer}.txt`,'utf8'),own=viewer==='a'?'nora@example.invalid':'bram@example.invalid',other=viewer==='a'?'bram@example.invalid':'nora@example.invalid';const occurrences=text.split(own).length-1;assert.equal(occurrences,480);const perPage=text.split('\f').filter(x=>x.trim());assert.equal(perPage.length,120);assert.ok(perPage.every(x=>x.split(own).length-1===4));assert.ok(!text.includes(other));results.cases.push({name:'server-watermark-'+viewer,markedPages:120,marks:occurrences,bytes:bytes.length});}
 assert.notEqual(hashes[0],hashes[1]);assert.deepEqual(results.pageErrors,[]);await context.close();console.log('PASS two distinct server-watermarked documents; 120 pages each; no cross-viewer mark');
}finally{await browser.close();writeFileSync(out+'/results.json',JSON.stringify(results,null,2));}
