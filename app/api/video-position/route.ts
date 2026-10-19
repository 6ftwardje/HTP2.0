import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";
import { ensureCurrentStudent } from "@/lib/students";
import { createClient } from "@/lib/supabase/server";
import { validVideoRef, validPositionBody } from "@/lib/video-position";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie"}});
const failure=(error:{code?:string},context:Record<string,unknown>)=>{logError("market.video_position.failed",error,context);const code=error.code;return reply({error:code==="42501"?"Je hebt geen toegang tot deze video.":code==="22023"?"De videogegevens zijn gewijzigd. Vernieuw de pagina.":"Hervatten is tijdelijk niet beschikbaar."},code==="42501"?403:code==="22023"?422:503);};
export async function GET(request:Request) {
 const {student}=await ensureCurrentStudent();if(!student)return reply({error:"Je bent niet aangemeld."},401);
 const db=await createClient(),url=new URL(request.url);
 if(url.searchParams.get("list")==="1") {
  const rows:unknown[]=[];
  for(let offset=0;;offset+=250){const {data,error}=await db.from("video_positions").select("lesson_id,weekly_update_id,video_version,position_seconds,duration_seconds,max_position_seconds,completed,revision").eq("student_id",student.id).order("id").range(offset,offset+249);if(error)return failure(error,{operation:"list",studentId:student.id,offset});rows.push(...(data??[]));if(!data||data.length<250)break;}
  return reply({viewerId:student.id,positions:rows});
 }
 const video=validVideoRef(url.searchParams.get("kind"),url.searchParams.get("id"));if(!video)return reply({error:"Ongeldige video."},400);
 const {data,error}=await db.rpc("read_video_position",{p_kind:video.kind,p_content_id:video.id});return error?failure(error,{operation:"read",studentId:student.id,video}):reply(data);
}
export async function POST(request:Request) {
 const origin=request.headers.get("origin");let sameOrigin=false;
 try{const url=new URL(origin??'');sameOrigin=origin===url.origin&&['http:','https:'].includes(url.protocol)&&url.host===(request.headers.get('host')??new URL(request.url).host);}catch{}
 if(!sameOrigin)return reply({error:"Ongeldige herkomst."},403);
 const {student}=await ensureCurrentStudent();if(!student)return reply({error:"Je bent niet aangemeld."},401);
 if(Number(request.headers.get("content-length"))>4096)return reply({error:"Ongeldige aanvraag."},413);
 let body:Record<string,unknown>;try{const raw=await request.text();if(raw.length>4096)return reply({error:"Ongeldige aanvraag."},413);body=JSON.parse(raw); }catch{return reply({error:"Ongeldige aanvraag."},400);}
 if(!body||typeof body!=="object"||Array.isArray(body)||!validPositionBody(body))return reply({error:"Ongeldige videopositie."},400);
 if(body.viewerId!==student.id)return reply({error:"Je account is gewijzigd. Vernieuw de pagina."},403);
 const db=await createClient();const {data,error}=await db.rpc("save_video_position",{p_kind:body.kind,p_content_id:body.id,p_viewer_id:student.id,p_video_version:body.videoVersion,p_position_seconds:body.positionSeconds,p_duration_seconds:body.durationSeconds,p_expected_revision:body.revision,p_session_id:body.sessionId,p_client_sequence:body.sequence});
 return error?failure(error,{operation:"save",studentId:student.id,kind:body.kind,contentId:body.id}):reply(data,data?.conflict?409:200);
}
