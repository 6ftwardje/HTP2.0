import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {authorizedPdf,pdfFailure,pdfHeaders,pdfJson,pdfOrigin,pdfJsonBody,PdfHttpError,pdfWork} from '@/lib/pdf/http';
import {validPdfId,pdfWatermark,PDF_MAX_INPUT} from '@/lib/pdf/policy';
import {watermarkPdf,PdfInputError} from '@/lib/pdf/transform';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 pdfOrigin(request);const {id}=await params;const {student,service,document}=await authorizedPdf(id);const body=await pdfJsonBody(request);
 if(!body||!validPdfId(body.requestId)||!validPdfId(body.version)||body.viewerId!==student.id)throw new PdfHttpError(409,'Je account of het document is gewijzigd. Vernieuw de pagina.');
 if(body.version!==document.version)throw new PdfHttpError(409,'Dit document is bijgewerkt. Open het opnieuw.');
 if(document.object_path!==`documents/${document.id}/source.pdf`)throw new PdfHttpError(404,'Dit document is niet beschikbaar.');
 const label=pdfWatermark(student.name,student.email),encodedLabel=encodeURIComponent(label);
 if(body.mode==='reading'){
  if(!document.accessible_verified||!document.accessible_html)throw new PdfHttpError(422,'Voor dit concept is nog geen gecontroleerde leesversie beschikbaar.');
  const {error}=await service.rpc('record_pdf_open',{p_document_id:id,p_version:document.version,p_request_id:body.requestId,p_student_id:student.id});if(error)throw new PdfHttpError(error.code==='22023'?409:403,'Je toegang of het document is gewijzigd. Open het opnieuw.',{cause:error});
  return pdfJson({viewerId:student.id,version:document.version,title:document.title,accessibleHtml:document.accessible_html,watermark:label});
 }
 const bytes=await pdfWork(async()=>{const {data,error}=await service.storage.from('protected-pdfs').download(document.object_path);if(error||!data)throw new PdfHttpError(404,'Het PDF-bestand is niet beschikbaar. Vraag de beheerder om herstel.',{cause:error});if(data.size>PDF_MAX_INPUT||data.size!==document.byte_size)throw new PdfHttpError(422,'De PDF-versie is ongeldig. Vraag de beheerder om herstel.');const source=new Uint8Array(await data.arrayBuffer());if(createHash('sha256').update(source).digest('hex')!==document.sha256)throw new PdfHttpError(422,'Het PDF-bestand is gewijzigd. Vraag de beheerder om herstel.');try{return await watermarkPdf(source,label);}catch(error){throw new PdfHttpError(error instanceof PdfInputError?422:503,error instanceof PdfInputError?error.message:'De persoonlijke PDF-verwerking is tijdelijk niet beschikbaar. Probeer opnieuw.',{cause:error});}});
 // Recheck live access/version AFTER transformation and before logging/delivery.
 const {error}=await service.rpc('record_pdf_open',{p_document_id:id,p_version:document.version,p_request_id:body.requestId,p_student_id:student.id});if(error)throw new PdfHttpError(error.code==='22023'?409:403,'Je toegang of het document is gewijzigd. Open het opnieuw.',{cause:error});
 return new NextResponse(new Uint8Array(bytes).buffer,{headers:{...pdfHeaders,'Content-Type':'application/pdf','Content-Disposition':'inline','Accept-Ranges':'none','X-PDF-Version':document.version,'X-PDF-Viewer':student.id,'X-PDF-Watermark':encodedLabel}});
}catch(error){return pdfFailure(error,request);}}
// Range/GET requests never expose an original or reuse a previous authorization.
export async function GET(){return new NextResponse(null,{status:405,headers:{...pdfHeaders,Allow:'POST'}});}
