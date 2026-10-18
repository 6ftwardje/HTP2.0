import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {createRequire} from 'node:module';import ts from 'typescript';import{PDFDocument,PDFName}from'pdf-lib';import*as policy from '../../lib/pdf/policy';
const require=createRequire(import.meta.url);const exports:any={};
const code=ts.transpileModule(readFileSync('lib/pdf/transform.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
runInNewContext(code,{exports,Buffer,process,require:(name:string)=>name==='server-only'?{}:name==='./policy'?policy:require(name)});
async function fixture(pages=1){const doc=await PDFDocument.create();for(let i=0;i<pages;i++)doc.addPage(i%2?[842,595]:[595,842]);return{doc,bytes:await doc.save()};}
test('PDF transform rejects non-PDF, over-limit pages and interactive annotations',async()=>{
 await assert.rejects(()=>exports.inspectPdf(new Uint8Array(10)),/geldige PDF/);await assert.rejects(()=>exports.inspectPdf(new Uint8Array(3*1024*1024+1)),/geldige PDF/);
 const large=await fixture(151);await assert.rejects(()=>exports.inspectPdf(large.bytes),/150/);const form=await fixture();form.doc.getPage(0).node.set(PDFName.of('Annots'),form.doc.context.obj([form.doc.context.obj({Type:'Annot',Subtype:'Link'})]));await assert.rejects(()=>form.doc.save().then(bytes=>exports.inspectPdf(bytes)));
});
test('server watermark supports accented names, landscape pages and identifiable fallback glyphs',async()=>{
 const source=await fixture(2);assert.equal((await exports.inspectPdf(source.bytes)).pageCount,2);const a=await exports.watermarkPdf(source.bytes,'Zoë D’Hondt · zoe@example.invalid · 18/10/2026'),b=await exports.watermarkPdf(source.bytes,'李 Proef · li@example.invalid · 18/10/2026');assert.notDeepEqual(a,b);assert.ok(a.length>source.bytes.length&&a.length<4*1024*1024);assert.equal((await PDFDocument.load(a)).getPageCount(),2);
});
test('personalization never returns a library result above the four MiB delivery cap',async()=>{
 const {bytes}=await fixture();const original=PDFDocument.prototype.save;
 try{PDFDocument.prototype.save=async()=>new Uint8Array(4*1024*1024+1);await assert.rejects(()=>exports.watermarkPdf(bytes,'F5a Proef · proef@example.invalid · 18/10/2026'),/4 MiB/);}finally{PDFDocument.prototype.save=original;}
});
