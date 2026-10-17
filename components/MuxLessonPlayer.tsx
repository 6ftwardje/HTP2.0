"use client";
import MuxPlayer, { type MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { MuxPlaybackTokens } from "@/lib/types";
import { createVideoSeekRequest, formatChapterTime, type VideoSeekRequest } from "@/lib/video-seek";
import { videoPositionKey, VIDEO_RATES, preferredVideoRate, storeVideoRate, type VideoRef } from "@/lib/video-position";
import { useVideoPosition } from "@/lib/use-video-position";
import { useVideoProgress } from "@/components/VideoProgressProvider";
import styles from "./MuxLessonPlayer.module.css";
type Props={playbackId:string;title?:string;onEnded?:(()=>void)|null;tokens?:MuxPlaybackTokens|null;seekRequest?:VideoSeekRequest|null;onError?:()=>void;onTimeUpdate?:(seconds:number)=>void;onSeekError?:(message:string|null)=>void;accentColor?:string;poster?:string|null;videoRef?:VideoRef;frameClassName?:string};
export function MuxLessonPlayer(props:Props){const context=useVideoProgress();return <Player key={`${context?.viewerId??'preview'}:${props.playbackId}:${props.videoRef?.kind}:${props.videoRef?.id}`} {...props}/>;}
const validPoster=(value:string|null|undefined)=>value&&/^(https?:\/\/|\/(?!\/))/.test(value)?value:undefined;
function Player({playbackId,title,onEnded,tokens,seekRequest,onError,onTimeUpdate,onSeekError,accentColor="var(--accent)",poster,videoRef,frameClassName}:Props){
 const playerRef=useRef<MuxPlayerRefAttributes|null>(null),viewer=useVideoProgress(),rateId=useId();
 const [rate,setRate]=useState(1),[posterSrc,setPosterSrc]=useState<string|undefined>(()=>validPoster(poster)),[jump,setJump]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[pendingSeek,setPendingSeek]=useState<VideoSeekRequest|null>(null);const jumpTimer=useRef<ReturnType<typeof setTimeout>>();
 const position=useVideoPosition(videoRef,`mux:${playbackId}`,!!seekRequest,rate);const choosePosition=position.choose;
 const completed=videoRef&&viewer?.positions[videoPositionKey(videoRef)]?.videoVersion===`mux:${playbackId}`&&viewer.positions[videoPositionKey(videoRef)].completed;
 useEffect(()=>{let chosen=1;if(viewer?.viewerId){try{chosen=preferredVideoRate(window.localStorage,viewer.viewerId);}catch{}}setRate(chosen);},[viewer?.viewerId]);
 useEffect(()=>{let cancelled=false;const valid=validPoster(poster);setPosterSrc(valid);if(valid){const image=new Image();image.onerror=()=>{if(!cancelled)setPosterSrc(undefined);};image.src=valid;}return()=>{cancelled=true;};},[poster,playbackId]);
 useEffect(()=>()=>{if(jumpTimer.current)clearTimeout(jumpTimer.current);},[]);
 useEffect(()=>{if(seekRequest){choosePosition();setPendingSeek(previous=>createVideoSeekRequest(seekRequest.seconds,previous));}},[seekRequest,choosePosition]);
 useEffect(()=>{
  const player=playerRef.current;if(!pendingSeek||!player)return;let cancelled=false,applied=false;
  const apply=()=>{if(cancelled||applied||player.readyState===0)return;applied=true;if(Number.isFinite(player.duration)&&pendingSeek.seconds>=player.duration){onSeekError?.('Dit tijdstip valt buiten de video. Kies een hoofdstuk of speel vanaf het begin.');return;}
   try{player.currentTime=pendingSeek.seconds;onSeekError?.(null);void player.play().catch(()=>{if(!cancelled){const text='Het tijdstip staat klaar. Druk op afspelen om verder te kijken.';onSeekError?.(text);setNotice(text);}});}catch{onSeekError?.('Springen is tijdelijk niet beschikbaar. Gebruik de tijdlijn in de speler.');}};
  player.addEventListener('loadedmetadata',apply);player.addEventListener('canplay',apply);apply();return()=>{cancelled=true;player.removeEventListener('loadedmetadata',apply);player.removeEventListener('canplay',apply);};
 },[pendingSeek,playbackId,onSeekError]);
 function pitch(){const player=playerRef.current;const media=player?.media?.shadowRoot?.querySelector('video')??player?.media;if(media&&'preservesPitch'in media)try{(media as HTMLVideoElement).preservesPitch=true;}catch{/* Capability is checked in runtime evidence. */}}
 function sample(){const player=playerRef.current;if(!player)return;position.sample(player.currentTime,player.duration);onTimeUpdate?.(player.currentTime);}
 function rateChanged(){const value=playerRef.current?.playbackRate??1;if(!(VIDEO_RATES as readonly number[]).includes(value))return;setRate(value);pitch();if(viewer?.viewerId)try{storeVideoRate(window.localStorage,viewer.viewerId,value);}catch{}}
 function keydown(event:KeyboardEvent<HTMLDivElement>){
  const player=playerRef.current;if(!player||event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
  if(event.nativeEvent.composedPath().some(node=>node instanceof HTMLElement&&(node.matches('input,textarea,select,button,a,[role="button"],[role="slider"],[role="menuitemradio"]')||node.isContentEditable)))return;
  const key=event.key.toLowerCase();if(![' ','arrowleft','arrowright','m','f'].includes(key))return;event.preventDefault();event.stopPropagation();
  if(key===' '){if(player.paused)void player.play().catch(()=>setNotice('Druk op afspelen om de video te starten.'));else player.pause();}
  if(key==='m')player.muted=!player.muted;
  if(key==='f')void(document.fullscreenElement?document.exitFullscreen():player.requestFullscreen()).catch(()=>setNotice('Volledig scherm is hier niet beschikbaar. Gebruik de spelerbediening.'));
  if(key==='arrowleft'||key==='arrowright'){const delta=key==='arrowright'?10:-10;position.choose();player.currentTime=Math.max(0,Math.min(Number.isFinite(player.duration)?player.duration:Infinity,player.currentTime+delta));sample();setJump(delta>0?'+10 s':'−10 s');if(jumpTimer.current)clearTimeout(jumpTimer.current);jumpTimer.current=setTimeout(()=>setJump(null),900);}
 }
 function resume(seconds:number){position.choose();setPendingSeek(previous=>createVideoSeekRequest(seconds,previous));}
 return <div className={styles.player} data-htp-player="mux">
  <div className={frameClassName??'relative aspect-video w-full overflow-hidden rounded-md bg-[var(--media-background)]'} tabIndex={0} role="group" aria-keyshortcuts="Space ArrowLeft ArrowRight M F" aria-label={`Videospeler${title?`: ${title}`:''}`} onKeyDownCapture={keydown}>
   <MuxPlayer ref={playerRef} playbackId={playbackId} videoTitle={title??'Lesvideo'} className="h-full w-full" primaryColor="var(--media-foreground)" secondaryColor="var(--media-background)" accentColor={accentColor} onError={onError} streamType="on-demand" tokens={tokens??undefined} poster={posterSrc} playbackRates={[...VIDEO_RATES]} playbackRate={rate} nohotkeys
    onLoadedMetadata={()=>{pitch();sample();}} onRateChange={rateChanged} onTimeUpdate={sample} onSeeked={sample}
    onPlay={()=>{setNotice(null);position.play();}} onPause={()=>{sample();position.pause();}} onEnded={()=>{sample();position.pause();onEnded?.();}} />
   {jump?<span className={styles.jump} role="status">{jump}</span>:null}
  </div>
  <div className={styles.toolbar}><label htmlFor={rateId}>Snelheid</label><select id={rateId} value={rate} onChange={event=>{const value=Number(event.target.value);setRate(value);if(playerRef.current)playerRef.current.playbackRate=value;rateChanged();}}>{VIDEO_RATES.map(value=><option key={value} value={value}>{value.toLocaleString('nl-BE')}×</option>)}</select>{completed?<span>Bekeken</span>:null}<span className={styles.shortcuts}>Spatie · ±10 s · M · F bij spelerfocus</span></div>
  {position.resume?<div className={styles.resume} role="group" aria-label="Verder kijken"><p>Verder kijken vanaf {formatChapterTime(position.resume.positionSeconds)}?</p><div><button type="button" className="cb-btn cb-btn-primary" onClick={()=>resume(position.resume!.positionSeconds)}>Verder kijken</button><button type="button" className="cb-btn cb-btn-secondary" onClick={()=>resume(0)}>Opnieuw beginnen</button></div></div>:null}
  {position.message?<div className={styles.feedback}><p role="status">{position.message}</p><button type="button" onClick={()=>void position.retry()}>{position.conflict?'Op dit apparaat verdergaan':'Opnieuw opslaan'}</button></div>:null}
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
 </div>;
}
