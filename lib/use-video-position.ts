"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVideoProgress } from "@/components/VideoProgressProvider";
import { videoSaveInterval, shouldOfferResume, type VideoPosition, type VideoRef } from "@/lib/video-position";
type Payload = VideoRef & {viewerId:string;videoVersion:string;revision:number;sessionId:string;sequence:number;positionSeconds:number;durationSeconds:number};
export function useVideoPosition(videoInput:VideoRef|undefined,videoVersion:string,explicitSeek:boolean,rate=1) {
 const kind=videoInput?.kind,id=videoInput?.id;
 const video=useMemo(()=>kind&&id?{kind,id}:undefined,[kind,id]);
 const context=useVideoProgress(),viewerId=context?.viewerId,publish=context?.publish;
 const [resume,setResume]=useState<VideoPosition|null>(null),[message,setMessage]=useState<string|null>(null),[conflict,setConflict]=useState(false);
 const snapshot=useRef<VideoPosition|null>(null),latest=useRef({positionSeconds:0,durationSeconds:0}),active=useRef(false),playing=useRef(false),busy=useRef(false),queued=useRef(false),mounted=useRef(false),blocked=useRef(false),sequence=useRef(0),session=useRef(''),lastSaved=useRef<number|null>(null),pending=useRef<Payload|null>(null);
 const explicit=useRef(explicitSeek);explicit.current=explicitSeek;
 const safeMessage=useCallback((value:string|null)=>{if(mounted.current)setMessage(value);},[]);
 const send=useCallback(async(payload:Payload,keepalive=false)=>{
  if(busy.current)return;busy.current=true;
  try{
   for(let attempt=0;attempt<3;attempt++){
    try{
     const response=await fetch('/api/video-position',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive,credentials:'same-origin'});
     const data=await response.json();if(!mounted.current)return;
     if(response.status===409){blocked.current=true;pending.current=null;setConflict(true);safeMessage('Je voortgang is op een ander apparaat bijgewerkt. Kies waar je verdergaat.');return;}
     if(response.status===401||response.status===403||response.status===422){blocked.current=true;pending.current=null;snapshot.current=null;safeMessage(data.error??'Vernieuw de pagina om je voortgang op te slaan.');return;}
     if(!response.ok)throw Error('storage');
     if(data.viewerId!==viewerId||data.videoVersion!==videoVersion){blocked.current=true;snapshot.current=null;safeMessage('De video of je account is gewijzigd. Vernieuw de pagina.');return;}
     if(data.accepted){snapshot.current=data;lastSaved.current=payload.positionSeconds;pending.current=null;blocked.current=false;safeMessage(null);if(video)publish?.(video,data);}return;
    }catch{if(keepalive||attempt===2||!mounted.current){blocked.current=true;pending.current=payload;safeMessage('Je voortgang kon niet worden opgeslagen. Probeer opnieuw zodra je verbinding hersteld is.');return;}await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));if(!mounted.current)return;}
   }
  }finally{busy.current=false;if(queued.current){queued.current=false;if(mounted.current)api.current.save();}}
 },[viewerId,videoVersion,video,publish,safeMessage]);
 const save=useCallback((keepalive=false)=>{
  const state=snapshot.current,sample=latest.current;if(!video||!viewerId||!state||!active.current||blocked.current||sample.durationSeconds<=0||sample.positionSeconds<0||sample.positionSeconds>sample.durationSeconds)return;
  if(lastSaved.current!==null&&Math.abs(lastSaved.current-sample.positionSeconds)<0.1)return;
  if(busy.current){queued.current=true;return;}
  const payload:Payload={...video,viewerId,videoVersion,revision:state.revision,sessionId:session.current,sequence:++sequence.current,...sample};void send(payload,keepalive);
 },[viewerId,videoVersion,video,send]);
 const api=useRef({save,send});api.current={save,send};
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!video||!viewerId)return null;
  const response=await fetch(`/api/video-position?kind=${video.kind}&id=${video.id}`,{cache:'no-store',signal});const data=await response.json();if(signal?.aborted||!mounted.current)return null;
  if(!response.ok){blocked.current=true;safeMessage(data.error??'Hervatten is tijdelijk niet beschikbaar.');return null;}
  if(data.viewerId!==viewerId||data.videoVersion!==videoVersion){blocked.current=true;safeMessage('De video of je account is gewijzigd. Vernieuw de pagina.');return null;}
  snapshot.current=data;publish?.(video,data);return data as VideoPosition;
 },[video,viewerId,videoVersion,publish,safeMessage]);
 useEffect(()=>{
  mounted.current=true;session.current=crypto.randomUUID();const abort=new AbortController();
  void load(abort.signal).then(data=>{if(!data)return;const offer=!explicit.current&&!playing.current&&shouldOfferResume(data);setResume(offer?data:null);active.current=!offer||playing.current;}).catch(()=>{if(!abort.signal.aborted)safeMessage('Hervatten is tijdelijk niet beschikbaar.');});
  const flush=()=>api.current.save(true),hidden=()=>{if(document.visibilityState==='hidden')flush();},online=()=>{if(pending.current)void api.current.send(pending.current);};
  window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);window.addEventListener('online',online);
  return()=>{api.current.save(true);mounted.current=false;abort.abort();window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('online',online);};
 },[load,safeMessage]);
 useEffect(()=>{if(playing.current)api.current.save();const timer=setInterval(()=>{if(playing.current&&navigator.onLine)api.current.save();},videoSaveInterval(rate));return()=>clearInterval(timer);},[rate]);
 useEffect(()=>{if(explicitSeek){active.current=true;setResume(null);}},[explicitSeek]);
 const sample=useCallback((positionSeconds:number,durationSeconds:number)=>{if(Number.isFinite(positionSeconds)&&Number.isFinite(durationSeconds)&&durationSeconds>0)latest.current={positionSeconds,durationSeconds};},[]);
 const choose=useCallback(()=>{active.current=true;setResume(null);},[]);
 const play=useCallback(()=>{playing.current=true;active.current=true;setResume(null);},[]);
 const pause=useCallback(()=>{playing.current=false;api.current.save();},[]);
 async function retry(){if(conflict){const data=await load().catch(()=>null);if(!data)return;setConflict(false);blocked.current=false;pending.current=null;active.current=true;lastSaved.current=null;api.current.save();}else if(pending.current){blocked.current=false;void api.current.send(pending.current);}else{blocked.current=false;await load().catch(()=>safeMessage('Hervatten is tijdelijk niet beschikbaar.'));}}
 return {resume,message,conflict,choose,sample,play,pause,retry};
}
