import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createServiceClient} from '@/lib/supabase/service';
import {pdfActor,pdfOrigin,pdfFailure,pdfJson,PdfHttpError} from '@/lib/pdf/http';
import {validPdfId,boundedPdfBody} from '@/lib/pdf/policy';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 pdfOrigin(request);await pdfActor(true);const {id}=await params;if(!validPdfId(id))throw new PdfHttpError(400,'Ongeldig document.');
 let form:FormData;try{const bytes=await boundedPdfBody(request,1024*1024+8192);form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')??''},body:bytes}).formData();}catch{throw new PdfHttpError(413,'Gebruik een cover van maximaal 1 MiB.');}
 const version=form.get('version'),file=form.get('file'),remove=form.get('remove')==='true';
 if(!validPdfId(version)||(!remove&&(!(file instanceof File)||file.size>1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))))throw new PdfHttpError(422,'Kies PNG, JPEG of WebP tot 1 MiB.');
 const service=createServiceClient(),{data:doc,error}=await service.from('pdf_documents').select('cover_path,version').eq('id',id).in('state',['draft','ready']).eq('storage_ready',true).maybeSingle();
 if(error)throw new PdfHttpError(503,'De cover kan nu niet worden opgeslagen.');if(!doc||doc.version!==version)throw new PdfHttpError(409,'Het document is gewijzigd. Vernieuw het overzicht.');
 const nextVersion=randomUUID(),path=remove?null:`covers/${id}/${nextVersion}.webp`;
 if(path&&file instanceof File){let image:Buffer;try{image=await sharp(await file.arrayBuffer(),{limitInputPixels:20000000}).rotate().resize({width:900,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}catch{throw new PdfHttpError(422,'De afbeelding kon niet worden gelezen. Kies een andere cover.');}if(image.length>1024*1024)throw new PdfHttpError(422,'De cover is te groot.');const uploaded=await service.storage.from('protected-learning-assets').upload(path,image,{contentType:'image/webp',upsert:false});if(uploaded.error)throw new PdfHttpError(503,'Coverupload mislukt. Probeer opnieuw.');}
 const saved=await service.from('pdf_documents').update({cover_path:path,version:nextVersion,updated_at:new Date().toISOString()}).eq('id',id).eq('version',version).in('state',['draft','ready']).select('id').maybeSingle();
 if(saved.error||!saved.data){if(path)await service.storage.from('protected-learning-assets').remove([path]);throw new PdfHttpError(saved.error?503:409,'Cover niet opgeslagen; het document is gewijzigd of tijdelijk niet beschikbaar. Vernieuw en probeer opnieuw.');}
 if(doc.cover_path)await service.storage.from('protected-learning-assets').remove([doc.cover_path]);
 return pdfJson({id,version:nextVersion});
}catch(error){return pdfFailure(error);}}
