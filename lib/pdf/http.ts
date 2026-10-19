import 'server-only';
import {logError} from '@/lib/logger';
import {NextResponse} from 'next/server';
import {getCurrentStudent,getCurrentAuthUser} from '@/lib/students';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {samePdfOrigin,validPdfId,boundedPdfBody} from './policy';
export type PdfRow={description:string;sort_order:number;shelf:"course"|"toolbox";cover_path:string|null;id:string;weekly_update_id:number|null;module_id:number|null;title:string;object_path:string;byte_size:number;page_count:number;sha256:string;version:string;state:string;storage_ready:boolean;accessible_html:string;accessible_verified:boolean;created_at:string;updated_at:string;error_message:string|null};
export class PdfHttpError extends Error {constructor(public status:number,message:string,options?:ErrorOptions){super(message,options);}}
export const pdfHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
export const pdfJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:pdfHeaders});
export function pdfFailure(error:unknown,request?:Request){logError('pdf.http.failed',error,{status:error instanceof PdfHttpError?error.status:503,path:request?new URL(request.url).pathname:undefined,method:request?.method});return error instanceof PdfHttpError?pdfJson({error:error.message},error.status):pdfJson({error:'PDF’s zijn tijdelijk niet beschikbaar. Probeer opnieuw.'},503);}
export function pdfOrigin(request:Request){if(!samePdfOrigin(request))throw new PdfHttpError(403,'Ongeldige herkomst. Vernieuw de pagina.');}
export async function pdfActor(admin=false){const {student}=await getCurrentStudent();if(!student)throw new PdfHttpError(401,'Meld je opnieuw aan.');if(admin&&student.access_level!==3)throw new PdfHttpError(403,'Alleen een beheerder kan dit uitvoeren.');const {user}=await getCurrentAuthUser();if(!user?.email||student.auth_user_id!==user.id)throw new PdfHttpError(401,'Meld je opnieuw aan.');return {...student,email:user.email};}
export async function pdfJsonBody(request:Request){try{return JSON.parse(new TextDecoder().decode(await boundedPdfBody(request,120000)));}catch{throw new PdfHttpError(400,'Ongeldige aanvraag.');}}
export async function authorizedPdf(id:string){
 if(!validPdfId(id))throw new PdfHttpError(404,'Dit document is niet beschikbaar.');
 const student=await pdfActor(),db=await createClient();const {data:allowed,error}=await db.rpc('can_read_pdf',{p_document_id:id});if(error)throw new PdfHttpError(503,'PDF’s zijn tijdelijk niet beschikbaar.',{cause:error});if(!allowed)throw new PdfHttpError(404,'Dit document is niet beschikbaar of je hebt geen toegang.');
 const service=createServiceClient();const {data,error:readError}=await service.from('pdf_documents').select('*').eq('id',id).maybeSingle();if(readError)throw new PdfHttpError(503,'PDF’s zijn tijdelijk niet beschikbaar.',{cause:readError});if(!data)throw new PdfHttpError(404,'Dit document is niet beschikbaar.');return {student,db,service,document:data as PdfRow};
}
export function pdfMetadata(row:PdfRow){return {id:row.id,title:row.title,pageCount:row.page_count,version:row.version,state:row.state,readingAvailable:row.accessible_verified&&!!row.accessible_html};}
let active=0;
export async function pdfWork<T>(work:()=>Promise<T>){if(active>=2)throw new PdfHttpError(503,'De PDF-verwerking is bezet. Probeer over enkele seconden opnieuw.');active++;try{return await work();}finally{active--;}}
