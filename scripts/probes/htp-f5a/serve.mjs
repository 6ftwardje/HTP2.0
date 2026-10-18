/** HTP-25 synthetic loopback laboratory; no app auth, storage or production endpoint. */
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const deps=resolve(process.env.HTP_PDF_PILOT_DEPS??'/tmp/htp-f5a-pilot/node_modules');
const require=createRequire(join(deps,'_pilot.cjs'));
const {PDFDocument,StandardFonts,rgb,degrees}=require('pdf-lib');
assert.equal(require('pdf-lib/package.json').version,'1.17.1');
assert.equal(JSON.parse(readFileSync(join(deps,'pdfjs-dist/package.json'))).version,'6.4.299');
const root=resolve('output/playwright/htp-f5a');mkdirSync(root,{recursive:true});
const viewers={a:'Nora Proef / nora@example.invalid / 18-10-2026',b:'Bram Proef / bram@example.invalid / 18-10-2026'};
const sources=Object.fromEntries(['one','large','encrypted','broken'].map(name=>[name,readFileSync(join(root,'fixtures',name+'.pdf'))]));
const measurements=[];
async function marked(source,viewer){const start=performance.now();const pdf=await PDFDocument.load(source);const font=await pdf.embedFont(StandardFonts.Helvetica);
 for(const page of pdf.getPages()){
  for(const y of [90,270,450,630])page.drawText(viewers[viewer],{x:24,y,size:13,font,rotate:degrees(28),opacity:.09,color:rgb(.12,.12,.12)});
 }
 const bytes=await pdf.save();measurements.push({viewer,pages:pdf.getPageCount(),inputBytes:source.length,outputBytes:bytes.length,elapsedMs:Math.round(performance.now()-start)});writeFileSync(join(root,'server-measurements.json'),JSON.stringify(measurements,null,2));return bytes;
}
const server=createServer(async(req,res)=>{try{
 if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403).end();return;}
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Cookie');
 if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(readFileSync('scripts/probes/htp-f5a/viewer.html'));return;}
 const vendor={'/vendor/pdf.mjs':'build/pdf.mjs','/vendor/pdf.worker.mjs':'build/pdf.worker.mjs'}[url.pathname];
 if(vendor){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(join(deps,'pdfjs-dist',vendor)));return;}
 if(url.pathname.startsWith('/vendor/fonts/')){const name=url.pathname.slice('/vendor/fonts/'.length);if(!/^[A-Za-z0-9_.-]+$/.test(name))throw Error('path');res.setHeader('Content-Type','application/octet-stream');res.end(readFileSync(join(deps,'pdfjs-dist/standard_fonts',name)));return;}
 if(url.pathname==='/fixture'){
  const name=url.searchParams.get('case')??'large',viewer=url.searchParams.get('viewer')??'a';if(!Object.hasOwn(sources,name)||!Object.hasOwn(viewers,viewer)){res.writeHead(404).end();return;}
  // Deliberately no authorization claim: this laboratory contains only synthetic documents.
  const bytes=name==='broken'||name==='encrypted'?sources[name]:await marked(sources[name],viewer);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Length',bytes.length);res.end(bytes);return;
 }
 res.writeHead(404).end();
}catch{res.writeHead(422,{'Content-Type':'text/plain'}).end('Deze synthetische PDF kan niet worden geladen.');}});
server.listen(3120,'127.0.0.1',()=>console.log('Synthetic HTP-25 probe http://127.0.0.1:3120'));
