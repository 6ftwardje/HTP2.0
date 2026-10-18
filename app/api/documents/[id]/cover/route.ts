import {NextResponse} from 'next/server';
import {authorizedPdf,pdfFailure,pdfHeaders,PdfHttpError} from '@/lib/pdf/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,{document,service}=await authorizedPdf(id);
 if(!document.cover_path||!new RegExp(`^covers/${id}/[a-f0-9-]{36}\\.webp$`).test(document.cover_path))throw new PdfHttpError(404,'Geen cover beschikbaar.');
 const {data,error}=await service.storage.from('protected-learning-assets').download(document.cover_path);
 if(error||!data||data.size>1024*1024)throw new PdfHttpError(404,'Geen cover beschikbaar.');
 return new NextResponse(await data.arrayBuffer(),{headers:{...pdfHeaders,'Content-Type':'image/webp','Content-Disposition':'inline'}});
}catch(error){return pdfFailure(error);}}
