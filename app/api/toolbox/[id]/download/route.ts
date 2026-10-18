import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {pdfActor,pdfFailure,pdfHeaders,PdfHttpError} from '@/lib/pdf/http';
import {validPdfId} from '@/lib/pdf/policy';
import {toolboxFilename,TOOLBOX_MAX_BYTES} from '@/lib/toolbox-policy';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 await pdfActor();const {id}=await params;if(!validPdfId(id))throw new PdfHttpError(404,'Bestand niet beschikbaar.');const db=await createClient();async function access(){const r=await db.rpc('can_read_toolbox_resource',{p_id:id});if(r.error||!r.data)throw new PdfHttpError(404,'Bestand niet beschikbaar of geen toegang.');}await access();
 const service=createServiceClient(),{data:row,error}=await service.from('toolbox_resources').select('*').eq('id',id).single();if(error||row.kind!=='file'||row.object_path!==`resources/${id}/source.bin`||!toolboxFilename(row.filename))throw new PdfHttpError(404,'Bestand niet beschikbaar.');
 const source=await service.storage.from('protected-learning-assets').download(row.object_path);if(source.error||!source.data||source.data.size!==row.byte_size||source.data.size>TOOLBOX_MAX_BYTES)throw new PdfHttpError(404,'Bestand niet beschikbaar. Vraag de beheerder om herstel.');const bytes=new Uint8Array(await source.data.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new PdfHttpError(422,'Het bestand is gewijzigd. Vraag de beheerder om herstel.');await access();const current=await service.from('toolbox_resources').select('version').eq('id',id).single();if(current.error||current.data.version!==row.version)throw new PdfHttpError(409,'Het bestand is gewijzigd. Open opnieuw.');
 return new NextResponse(bytes.buffer,{headers:{...pdfHeaders,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${toolboxFilename(row.filename)}"`,'Accept-Ranges':'none'}});
}catch(e){return pdfFailure(e);}}
