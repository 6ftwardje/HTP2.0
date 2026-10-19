"use client";
import {logError} from "@/lib/logger";
import {useEffect,useRef,useState} from 'react';
type Position={viewerId:string;version:string;page:number;revision:number;conflict?:boolean};
type Body={viewerId:string;version:string;page:number;revision:number;sessionId:string;sequence:number};
type Session={id:string;viewerId:string;version:string;sessionId:string;sequence:number;revision:number;page:number;saved:number;loaded:boolean;busy:boolean;blocked:boolean;retry:Body|null;conflict:Position|null};
/** Bounded, single-flight writes. Closing flushes best-effort; there is no offline completion claim. */
export function usePdfPosition({documentId,viewerId,version,active,page,onRestore}:{documentId:string;viewerId:string;version:string|null;active:boolean;page:number;onRestore:(page:number)=>void}){
 const session=useRef<Session|null>(null),restore=useRef(onRestore);restore.current=onRestore;if(session.current&&active)session.current.page=page;
 const [state,setState]=useState<'idle'|'loading'|'error'|'conflict'|'fatal'>('idle'),[message,setMessage]=useState('');
 function feedback(s:Session,status:typeof state,text:string){if(session.current===s){setState(status);setMessage(text);}}
 async function send(s:Session,target=s.page,retry:Body|null=null,force=false){
  if(!s.loaded||s.busy||s.blocked||(!retry&&!force&&target===s.saved))return;
  s.busy=true;const body=retry??{viewerId:s.viewerId,version:s.version,page:target,revision:s.revision,sessionId:s.sessionId,sequence:++s.sequence};
  try{
   const r=await fetch(`/api/documents/${s.id}/position`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}),data=await r.json();
   if(r.status===409&&data.conflict){s.blocked=true;s.conflict=data;s.retry=null;feedback(s,'conflict','Je leespositie is op een ander apparaat gewijzigd. Kies welke positie je wilt bewaren.');return;}
   if(!r.ok){if([401,403,409,400].includes(r.status)){s.blocked=true;s.retry=null;feedback(s,'fatal',data.error??'Je toegang of het document is gewijzigd. Open opnieuw.');return;}throw Error('network');}
   if(data.viewerId!==s.viewerId||data.version!==s.version)throw Error('identity');
   s.revision=data.revision;s.saved=data.page;s.retry=null;feedback(s,'idle','');
  }catch(error){logError('pdf.position.save_failed',error,{documentId:s.id,viewerId:s.viewerId,version:s.version});s.blocked=true;s.retry=body;feedback(s,'error','Je leespositie is niet bevestigd opgeslagen. Controleer je verbinding en probeer opnieuw.');}
  finally{s.busy=false;if(s.loaded&&!s.blocked&&s.page!==s.saved)void send(s);}
 }
 async function load(s:Session,signal?:AbortSignal){
  const openedPage=s.page;s.loaded=false;s.blocked=true;feedback(s,'loading','Leespositie laden…');
  try{const r=await fetch(`/api/documents/${s.id}/position?version=${s.version}`,{cache:'no-store',signal}),data=await r.json();if(!r.ok||data.viewerId!==s.viewerId||data.version!==s.version)throw Error('load');if(session.current!==s)return;
   const target=s.page!==openedPage?s.page:data.page;s.revision=data.revision;s.saved=data.page;s.page=target;s.retry=null;s.conflict=null;s.loaded=true;s.blocked=false;restore.current(target);feedback(s,'idle',target>1?`Hervat op pagina ${target}.`:'');
  }catch(error){if(!signal?.aborted){logError('pdf.position.load_failed',error,{documentId:s.id,viewerId:s.viewerId,version:s.version});feedback(s,'error','De leespositie kon niet worden geladen. Herlaad de positie om opslaan te activeren.');}}
 }
 useEffect(()=>{
  if(!active||!version){setState('idle');setMessage('');return;}
  const s:Session={id:documentId,viewerId,version,sessionId:crypto.randomUUID(),sequence:0,revision:0,page:1,saved:1,loaded:false,busy:false,blocked:true,retry:null,conflict:null};session.current=s;
  const abort=new AbortController();void load(s,abort.signal);
  const flush=()=>{if(document.visibilityState!=='visible')void send(s);};const hide=()=>void send(s);
  document.addEventListener('visibilitychange',flush);window.addEventListener('pagehide',hide);
  return()=>{abort.abort();void send(s);document.removeEventListener('visibilitychange',flush);window.removeEventListener('pagehide',hide);if(session.current===s)session.current=null;};
  // Session identity changes restart the owner/version-specific read, not every callback render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,version,documentId,viewerId]);
 useEffect(()=>{const s=session.current;if(!active||!s||!s.loaded||s.blocked||s.page===s.saved)return;const timer=setTimeout(()=>void send(s),800);return()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,page,version,state]);
 return {state,message,
  reload:()=>{const s=session.current;if(s&&!s.busy)void load(s);},
  retry:()=>{const s=session.current;if(!s)return;if(!s.loaded){void load(s);return;}s.blocked=false;void send(s,s.page,s.retry);},
  overwrite:()=>{const s=session.current;if(!s?.conflict||s.busy)return;s.revision=s.conflict.revision;s.conflict=null;s.retry=null;s.blocked=false;void send(s,s.page,null,true);},
  restart:()=>{const s=session.current;if(!s?.loaded||s.blocked)return;s.page=1;restore.current(1);void send(s,1,null,true);},
 };
}
