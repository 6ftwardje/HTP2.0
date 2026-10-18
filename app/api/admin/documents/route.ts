import {randomUUID,createHash} from 'node:crypto';
import {createServiceClient} from '@/lib/supabase/service';
import {pdfActor,pdfFailure,pdfJson,pdfOrigin,pdfWork,PdfHttpError} from '@/lib/pdf/http';
import {boundedPdfBody,pdfTitle,pdfReadingHtml,hasPdfReadingText,PDF_MAX_INPUT,PDF_MAX_HTML} from '@/lib/pdf/policy';
import {inspectPdf} from '@/lib/pdf/transform';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(request:Request){try{
 await pdfActor(true);const service=createServiceClient();const raw=Number(new URL(request.url).searchParams.get('page')??0);const page=Number.isSafeInteger(raw)&&raw>=0&&raw<10000?raw:0;
 const [docs,logs,modules,updates]=await Promise.all([
  service.from('pdf_documents').select('id,title,state,storage_ready,page_count,version,accessible_html,accessible_verified,weekly_update_id,module_id,error_message,created_at').order('created_at',{ascending:false}).range(page*50,page*50+49),
  service.from('pdf_open_logs').select('id,document_id,document_title,document_version,student_id,opened_at').gte('opened_at',new Date(Date.now()-30*86400000).toISOString()).order('opened_at',{ascending:false}).range(page*100,page*100+99),
  service.from('modules').select('id,title').order('order_index').limit(1000),service.from('weekly_updates').select('id,title').order('id',{ascending:false}).limit(200)
 ]);if(docs.error||logs.error||modules.error||updates.error)throw new PdfHttpError(503,'PDF-beheer is tijdelijk niet beschikbaar.');
 const ids=[...new Set((logs.data??[]).map(x=>x.student_id))];const names=ids.length?await service.from('students').select('id,name').in('id',ids):{data:[],error:null};if(names.error)throw new PdfHttpError(503,'Het openlog is tijdelijk niet beschikbaar.');const namesById=new Map((names.data??[]).map(x=>[x.id,x.name]));
 return pdfJson({documents:docs.data,logs:(logs.data??[]).map(x=>({...x,viewerName:namesById.get(x.student_id)??'Verwijderd account'})),modules:modules.data,updates:updates.data,page,hasMore:(docs.data?.length??0)===50||(logs.data?.length??0)===100});
}catch(error){return pdfFailure(error);}}
export async function POST(request:Request){try{
 pdfOrigin(request);const actor=await pdfActor(true);let form:FormData;try{const bytes=await boundedPdfBody(request,PDF_MAX_INPUT+PDF_MAX_HTML+65536);form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')??''},body:bytes}).formData();}catch{throw new PdfHttpError(413,'Gebruik een PDF van maximaal 3 MiB en een begrensde leesversie.');}
 const title=pdfTitle(form.get('title')),html=pdfReadingHtml(form.get('accessibleHtml')??''),file=form.get('file'),parent=Number(form.get('parentId')),kind=form.get('parentKind'),publish=form.get('publish')==='true',verified=form.get('accessibleVerified')==='true';
 if(!title||html===null||!Number.isSafeInteger(parent)||parent<=0||!['module','update'].includes(String(kind)))throw new PdfHttpError(400,'Vul titel, een geldige ouder en de leesversie correct in.');
 if(!(file instanceof File)||file.size<1||file.size>PDF_MAX_INPUT||!file.name.toLowerCase().endsWith('.pdf'))throw new PdfHttpError(422,'Kies een PDF-bestand van maximaal 3 MiB.');
 if(publish&&(!verified||!hasPdfReadingText(html)))throw new PdfHttpError(422,'Controleer de volledige leesversie met chart-/tabelbeschrijvingen vóór publicatie.');
 const service=createServiceClient();const parentResult=await service.from(kind==='module'?'modules':'weekly_updates').select('id').eq('id',parent).maybeSingle();if(parentResult.error||!parentResult.data)throw new PdfHttpError(422,'De gekozen module of update bestaat niet.');
 const bytes=new Uint8Array(await file.arrayBuffer());let pageCount:number;try{pageCount=(await pdfWork(()=>inspectPdf(bytes))).pageCount;}catch(error){if(error instanceof PdfHttpError)throw error;throw new PdfHttpError(422,error instanceof Error?error.message:'Deze PDF is ongeldig.');}
 const id=randomUUID(),objectPath=`documents/${id}/source.pdf`;const {error:createError}=await service.from('pdf_documents').insert({id,title,weekly_update_id:kind==='update'?parent:null,module_id:kind==='module'?parent:null,object_path:objectPath,byte_size:bytes.length,page_count:pageCount,sha256:createHash('sha256').update(bytes).digest('hex'),accessible_html:html,accessible_verified:verified,created_by:actor.id});if(createError)throw new PdfHttpError(503,'PDF-metadata kon niet worden opgeslagen. Er is geen bestand geüpload.');
 const uploaded=await service.storage.from('protected-pdfs').upload(objectPath,bytes,{contentType:'application/pdf',upsert:false});if(uploaded.error){await service.from('pdf_documents').update({state:'error',error_message:'Upload mislukt. Verwijder dit concept en upload opnieuw.'}).eq('id',id);throw new PdfHttpError(503,'Upload mislukt; het herstelbare concept staat in het overzicht.');}
 const {error:finishError}=await service.from('pdf_documents').update({storage_ready:true,state:publish?'ready':'draft',updated_at:new Date().toISOString()}).eq('id',id);if(finishError)throw new PdfHttpError(503,'Upload staat klaar, maar afronden mislukte. Verwijder het concept en probeer opnieuw.');return pdfJson({id},201);
}catch(error){return pdfFailure(error);}}
