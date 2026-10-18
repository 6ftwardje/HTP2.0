import {authorizedPdf,pdfMetadata,pdfFailure,pdfJson} from '@/lib/pdf/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const {student,document}=await authorizedPdf(id);return pdfJson({viewerId:student.id,...pdfMetadata(document)});}catch(error){return pdfFailure(error);}}
