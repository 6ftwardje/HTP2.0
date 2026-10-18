/** Real loopback F5a acceptance. Synthetic accounts/parents only; no remote traffic. */
import assert from 'node:assert/strict';import{createRequire}from'node:module';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{randomUUID,createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{createClient}=require('@supabase/supabase-js');
const base=process.env.HTP_F5A_BASE_URL??'http://127.0.0.1:3118';assert.equal(new URL(base).hostname,'127.0.0.1');
const keys=Object.fromEntries([...readFileSync(process.env.LOCAL_SUPABASE_ENV_FILE,'utf8').matchAll(/^([A-Z_]+)="([^"\n]*)"$/gm)].map(x=>[x[1],x[2]]));assert.equal(new URL(keys.API_URL).hostname,'127.0.0.1');
const fixtures=JSON.parse(readFileSync(process.env.HTP_F5A_FIXTURE_FILE));assert.ok(fixtures.users.every(x=>x.email.endsWith('@example.invalid'))&&fixtures.modules.every(x=>x.slug.startsWith('f5a-local-'))&&fixtures.updates.every(x=>x.slug.startsWith('f5a-local-')));
const out='output/playwright/htp-f5a/integration';mkdirSync(out+'/visual',{recursive:true});
const db=createClient(keys.API_URL,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),browser=await chromium.launch({channel:'chrome'}),contexts=[];
const results={base,synthetic:true,browser:'Chrome / mobile emulation',behavior:[],visual:[],errors:[],documents:[]};
const user=role=>fixtures.users.find(x=>x.role===role),paidModule=fixtures.modules.find(x=>!x.isFree),freeModule=fixtures.modules.find(x=>x.isFree),freeUpdate=fixtures.updates.find(x=>x.suffix==='free');
const reading='<h2>Een rustig handelsplan</h2><p>Dit is volledige synthetische leesinhoud voor de PDF-proef.</p><h3>Scenario en risico</h3><p>De voorbeeldpagina bevat uitsluitend tekst, geen inhoudelijke afbeelding. Pagina’s herhalen dezelfde uitleg.</p><table><caption>Vooraf vastleggen</caption><tr><th scope="col">Onderdeel</th><th scope="col">Beschrijving</th></tr><tr><td>Scenario</td><td>Een fictief plan zonder echt marktsignaal.</td></tr></table>';
function save(){writeFileSync(out+'/image-results.json',JSON.stringify(results,null,2));}
function record(test,detail={}){results.behavior.push({test,...detail});save();console.log('PASS '+test);}
async function context(role='student',width=1440,theme='dark'){
 const c=await browser.newContext({viewport:{width,height:1000},isMobile:width===375,hasTouch:width===375,deviceScaleFactor:width===375?3:1,reducedMotion:'reduce',locale:'nl-BE'});contexts.push(c);if(role)await c.addCookies(user(role).cookies);await c.addInitScript(theme=>{try{localStorage.setItem('htp-theme',theme);}catch{}},theme);
 await c.route('**/*',r=>{const u=new URL(r.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)?r.continue():r.abort();});c.on('page',p=>p.on('pageerror',e=>results.errors.push(e.message)));return c;
}
async function json(c,path,method='GET',data){const r=await c.request.fetch(base+path,{method,headers:method==='GET'?{}:{Origin:base},data});return{status:r.status(),data:await r.json(),response:r};}
async function upload(c,{title='F5a API proef',file='mixed',kind='module',parent=paidModule.id,publish=true,verified=true,html=reading,buffer}={}){const r=await c.request.post(base+'/api/admin/documents',{headers:{Origin:base},multipart:{title,parentKind:kind,parentId:String(parent),publish:String(publish),accessibleVerified:String(verified),accessibleHtml:html,file:{name:file+'.pdf',mimeType:'application/pdf',buffer:buffer??readFileSync(fixtures.out+'/'+file+'.pdf')}}});return{status:r.status(),data:await r.json()};}
async function metadata(c,id){return json(c,'/api/documents/'+id);}
async function open(c,id,meta,requestId=randomUUID(),extra={}){return c.request.post(base+`/api/documents/${id}/open`,{headers:{Origin:base,...extra},data:{viewerId:meta.viewerId,version:meta.version,requestId}});}
async function row(id){const r=await db.from('pdf_documents').select('*').eq('id',id).single();assert.equal(r.error,null);return r.data;}
async function logCount(id){const r=await db.from('pdf_open_logs').select('id',{count:'exact',head:true}).eq('document_id',id);assert.equal(r.error,null);return r.count;}
async function goto(p,path){await p.goto(base+path);await p.locator('main').waitFor();await p.waitForFunction(()=>!document.querySelector('[hidden][id^="S:"]'));}
async function ready(p){await p.locator('dialog[data-protected-pdf][open] canvas').first().waitFor();await p.waitForFunction(()=>document.querySelector('dialog[data-protected-pdf]')?.dataset.rendering==='false');}
const sql=statement=>execFileSync('docker',['exec','supabase_db_htp-f2-local','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',statement],{encoding:'utf8'});

try{
 const {PDFDocument}=require('pdf-lib'),document=await PDFDocument.create(),image=await document.embedJpg(readFileSync(out+'/five-megapixel.jpg'));assert.equal(image.width*image.height,5000000);const paper=document.addPage([595,842]);paper.drawImage(image,{x:40,y:40,width:515,height:742});const bytes=await document.save();assert.ok(bytes.length<3*1024*1024);writeFileSync(out+'/five-megapixel.pdf',bytes);
 const admin=await context('admin'),created=await upload(admin,{title:'F5a grote afbeelding',file:'five-megapixel',html:'<h2>Beeldproef</h2><p>Deze synthetische pagina bevat een egaal blauw vlak zonder marktinformatie of verdere betekenis.</p>'});assert.equal(created.status,201);results.documents.push({name:'large-image',id:created.data.id});
 const c=await context('student',375),p=await c.newPage();await goto(p,'/documents/'+created.data.id);await p.getByRole('button',{name:'Open document',exact:true}).click();await ready(p);const pixel=await p.locator('canvas').first().evaluate(canvas=>({rgba:[...canvas.getContext('2d').getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data],pixels:canvas.width*canvas.height}));assert.ok(pixel.rgba[2]>160&&pixel.rgba[0]<80&&pixel.rgba[1]<120&&pixel.rgba[3]===255,JSON.stringify(pixel));assert.ok(pixel.pixels<=2000000);assert.deepEqual(results.errors,[]);record('a five-megapixel source image remains visible on mobile while its rendered canvas stays under two million pixels',pixel);
}finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();save();}
