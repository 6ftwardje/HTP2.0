"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { videoPositionKey, type VideoPosition, type VideoRef } from "@/lib/video-position";
type Context = { viewerId: string; positions: Record<string,VideoPosition>; publish: (video:VideoRef,position:VideoPosition)=>void };
const ProgressContext=createContext<Context|null>(null);
export const useVideoProgress = () => useContext(ProgressContext);
export function VideoProgressProvider({viewerId,children}:{viewerId:string;children:ReactNode}) {
 const [positions,setPositions]=useState<Record<string,VideoPosition>>({});const pathname=usePathname();
 const publish=useCallback((video:VideoRef,position:VideoPosition)=>{if(position.viewerId!==viewerId)return;setPositions(previous=>({...previous,[videoPositionKey(video)]:position}));window.dispatchEvent(new CustomEvent("htp-video-position",{detail:{video,position}}));},[viewerId]);
 useEffect(()=>{
  const abort=new AbortController();
  async function load(){try{const response=await fetch('/api/video-position?list=1',{signal:abort.signal,cache:'no-store'});if(!response.ok)return;const data=await response.json();if(data.viewerId!==viewerId||abort.signal.aborted)return;const next:Record<string,VideoPosition>={};for(const row of data.positions){const video:VideoRef=row.lesson_id?{kind:'lesson',id:row.lesson_id}:{kind:'update',id:row.weekly_update_id};next[videoPositionKey(video)]={viewerId,videoVersion:row.video_version,revision:row.revision,positionSeconds:row.position_seconds,durationSeconds:row.duration_seconds,maxPositionSeconds:row.max_position_seconds,completed:row.completed};}setPositions(next);}catch{/* The player exposes storage errors; cards remain usable. */}}
  void load();const visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);
  return()=>{abort.abort();document.removeEventListener('visibilitychange',visible);};
 },[viewerId,pathname]);
 const value=useMemo(()=>({viewerId,positions,publish}),[viewerId,positions,publish]);return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}
export function VideoThumbnailProgress({video}:{video:VideoRef}) {
 const context=useVideoProgress(),position=context?.positions[videoPositionKey(video)];if(!position||position.durationSeconds<=0||position.maxPositionSeconds<=0)return null;
 const percent=Math.min(100,Math.round(position.maxPositionSeconds/position.durationSeconds*100));
 return <><span className="video-thumbnail-progress" role="progressbar" aria-label="Videovoortgang" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:`${percent}%`}} /></span>{position.completed?<span className="video-thumbnail-completed">Bekeken</span>:null}</>;
}
