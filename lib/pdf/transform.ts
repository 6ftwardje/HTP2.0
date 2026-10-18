import 'server-only';
import {PDFDocument,PDFName,PDFArray,PDFDict,rgb,degrees} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PDF_MAX_INPUT,PDF_MAX_OUTPUT,PDF_MAX_PAGES} from './policy';
export class PdfInputError extends Error {}
let fontData:Promise<Buffer>|undefined;
async function load(bytes:Uint8Array){
 if(bytes.length<8||bytes.length>PDF_MAX_INPUT||!Buffer.from(bytes.subarray(0,5)).equals(Buffer.from('%PDF-')))throw new PdfInputError('Gebruik een geldige PDF van maximaal 3 MiB.');
 let doc:PDFDocument;try{doc=await PDFDocument.load(bytes,{updateMetadata:false});}catch{throw new PdfInputError('Deze PDF is beschadigd of versleuteld. Gebruik een leesbare versie zonder wachtwoord.');}
 if(doc.getPageCount()<1||doc.getPageCount()>PDF_MAX_PAGES)throw new PdfInputError('Een PDF mag maximaal 150 pagina’s bevatten.');
 try{
 const names=doc.catalog.lookupMaybe(PDFName.of('Names'),PDFDict);
 if(['OpenAction','AA','AcroForm'].some(key=>doc.catalog.has(PDFName.of(key)))||(names&&'has'in names&&['JavaScript','EmbeddedFiles'].some(key=>(names as {has:(key:PDFName)=>boolean}).has(PDFName.of(key)))))throw new PdfInputError('Gebruik een PDF zonder formulieren, scripts of bijlagen.');
 for(const page of doc.getPages()){
  const box=page.getSize();if(!Number.isFinite(box.width)||!Number.isFinite(box.height)||box.width<72||box.height<72||box.width>14400||box.height>14400)throw new PdfInputError('Deze PDF heeft een onbruikbaar paginaformaat.');
  if(page.node.has(PDFName.of('AA'))||(page.node.lookupMaybe(PDFName.of('Annots'),PDFArray)?.size()??0)>0)throw new PdfInputError('Gebruik een vlakke PDF zonder interactieve annotaties of links.');
 }
 return doc;
 }catch(error){if(error instanceof PdfInputError)throw error;throw new PdfInputError('Deze PDF kan niet worden gelezen. Gebruik een vlakke versie zonder interactieve inhoud.');}
}
export async function inspectPdf(bytes:Uint8Array){const doc=await load(bytes);return {pageCount:doc.getPageCount()};}
export async function watermarkPdf(bytes:Uint8Array,label:string){
 const doc=await load(bytes);doc.registerFontkit(fontkit);fontData??=readFile(path.join(process.cwd(),'assets/pdf-fonts/NotoSans-Regular.ttf'));const font=await doc.embedFont(await fontData,{subset:true});
 const supported=new Set(font.getCharacterSet());const safe=[...label].map(char=>supported.has(char.codePointAt(0)!)?char:`U+${char.codePointAt(0)!.toString(16).toUpperCase()}`).join('');
 for(const page of doc.getPages()){
  const {width,height}=page.getSize();const unit=font.widthOfTextAtSize(safe,1);const size=Math.min(14,(width-32)/Math.max(1,unit),height*.20/(Math.sin(24*Math.PI/180)*Math.max(1,unit)));
  for(const fraction of [.12,.32,.52,.72])page.drawText(safe,{x:16,y:height*fraction,font,size,rotate:degrees(24),opacity:.09,color:rgb(.12,.12,.12)});
 }
 const result=await doc.save();if(result.length>PDF_MAX_OUTPUT)throw new PdfInputError('Deze PDF is na het watermerk groter dan 4 MiB. Optimaliseer of splits het document.');return result;
}
