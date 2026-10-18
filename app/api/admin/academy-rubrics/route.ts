import {createClient} from '@/lib/supabase/server';
import {pdfActor,pdfOrigin,pdfJsonBody,pdfJson,pdfFailure,PdfHttpError} from '@/lib/pdf/http';
import {pdfTitle,validPdfId} from '@/lib/pdf/policy';
export const dynamic='force-dynamic';
export async function GET(){try{
 await pdfActor(true);const db=await createClient();
 // Read each rubric version and its exact module mapping in one database snapshot.
 const rubrics:{id:string;title:string;slug:string;description:string;sort_order:number;is_published:boolean;version:number;academy_rubric_modules:{module_id:number}[]}[]=[];for(let offset=0;;offset+=250){const result=await db.from('academy_rubrics').select('*,academy_rubric_modules(module_id)').order('sort_order').order('id').range(offset,offset+249);if(result.error)throw new PdfHttpError(503,'De Academy-indeling is tijdelijk niet beschikbaar.');rubrics.push(...(result.data??[]));if(!result.data||result.data.length<250)break;}
 const modules:{id:number;title:string;order_index:number}[]=[];for(let offset=0;;offset+=250){const result=await db.from('modules').select('id,title,order_index').order('order_index').order('id').range(offset,offset+249);if(result.error)throw new PdfHttpError(503,'De modules zijn tijdelijk niet beschikbaar.');modules.push(...(result.data??[]));if(!result.data||result.data.length<250)break;}
 return pdfJson({rubrics:rubrics.map(({academy_rubric_modules,...r})=>({...r,moduleIds:(academy_rubric_modules??[]).map((m:{module_id:number})=>m.module_id)})),modules});
}catch(e){return pdfFailure(e);}}
export async function POST(request:Request){try{
 pdfOrigin(request);await pdfActor(true);const b=await pdfJsonBody(request),title=pdfTitle(b?.title);
 if(!title||typeof b.slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(b.slug)||typeof b.description!=='string'||b.description.length>1000||!Array.isArray(b.moduleIds)||b.moduleIds.length>100||b.moduleIds.some((x:unknown)=>!Number.isSafeInteger(x)||Number(x)<=0)||!Number.isSafeInteger(b.sortOrder)||b.sortOrder<0||b.sortOrder>10000||typeof b.published!=='boolean'||(b.id&&!validPdfId(b.id))||(b.id&&(!Number.isSafeInteger(b.version)||b.version<1)))throw new PdfHttpError(422,'Controleer titel, URL-naam, beschrijving, volgorde en modulekeuze.');
 const db=await createClient(),{data,error}=await db.rpc('save_academy_rubric',{p_id:b.id??null,p_version:b.version??0,p_title:title,p_slug:b.slug,p_description:b.description,p_sort_order:b.sortOrder,p_published:b.published,p_modules:b.moduleIds});
 if(error)throw new PdfHttpError(error.code==='40001'?409:422,error.code==='40001'?'De indeling is elders gewijzigd. Herlaad vóór je opnieuw opslaat.':'Opslaan mislukt. Controleer of de URL-naam uniek is en de modulekeuze geldig is.');return pdfJson({id:data});
}catch(e){return pdfFailure(e);}}
export async function DELETE(request:Request){try{
 pdfOrigin(request);await pdfActor(true);const b=await pdfJsonBody(request);if(!validPdfId(b?.id)||!Number.isSafeInteger(b.version))throw new PdfHttpError(400,'Ongeldige rubriek.');const db=await createClient(),{error}=await db.rpc('delete_academy_rubric',{p_id:b.id,p_version:b.version});if(error)throw new PdfHttpError(error.code==='40001'?409:503,'Verwijderen mislukt of de rubriek is gewijzigd. Herlaad en probeer opnieuw.');return pdfJson({deleted:true});
}catch(e){return pdfFailure(e);}}
