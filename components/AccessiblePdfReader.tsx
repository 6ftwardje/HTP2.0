"use client";
import {logError} from "@/lib/logger";
import {useEffect,useRef,useState} from 'react';
import styles from './ProtectedPdfViewer.module.css';
type Reading={title:string;accessibleHtml:string;watermark:string;viewerId:string;version:string};
/** Independent semantic reading route; never imports PDF.js or downloads PDF bytes. */
export function AccessiblePdfReader({documentId,viewerId}:{documentId:string;viewerId:string}){
 const [reading,setReading]=useState<Reading|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);const requestId=useRef(''),lastVersion=useRef('');
 useEffect(()=>{
  const abort=new AbortController();requestId.current||=crypto.randomUUID();setError('');setReading(null);
  async function load(){
   const meta=await fetch(`/api/documents/${documentId}`,{signal:abort.signal,cache:'no-store'});const data=await meta.json();if(!meta.ok||data.viewerId!==viewerId)throw Error(data.error??'Je account is gewijzigd. Vernieuw de pagina.');
   if(lastVersion.current&&lastVersion.current!==data.version)requestId.current=crypto.randomUUID();lastVersion.current=data.version;
   const response=await fetch(`/api/documents/${documentId}/open`,{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({viewerId,version:data.version,requestId:requestId.current,mode:'reading'})});const body=await response.json();if(!response.ok||body.viewerId!==viewerId)throw Error(body.error??'De leesversie is niet beschikbaar.');if(!abort.signal.aborted)setReading(body);
  }
  void load().catch(error=>{if(!abort.signal.aborted){logError('pdf.reading.load_failed',error,{documentId,viewerId});setError('De leesversie kon niet worden geladen. Controleer je toegang en verbinding of vernieuw de pagina.');}});return()=>abort.abort();
 },[documentId,viewerId,attempt]);
 useEffect(()=>{
  if(!reading)return;const abort=new AbortController();async function check(){if(document.visibilityState!=='visible')return;try{const r=await fetch(`/api/documents/${documentId}`,{signal:abort.signal,cache:'no-store'}),data=await r.json();if(!r.ok||data.viewerId!==viewerId||data.version!==reading?.version){setReading(null);setError('Je toegang, account of document is gewijzigd. Vernieuw de pagina.');}}catch(error){if(!abort.signal.aborted)logError('pdf.reading.recheck_failed',error,{documentId,viewerId});}}
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);return()=>{abort.abort();window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
 },[reading,documentId,viewerId]);
 if(error)return <div><p role="alert">{error}</p><button className="cb-btn cb-btn-secondary" onClick={()=>setAttempt(value=>value+1)}>Opnieuw proberen</button> <button className="cb-btn cb-btn-secondary" onClick={()=>location.reload()}>Pagina vernieuwen</button></div>;
 if(!reading)return <p role="status">Je persoonlijke leesversie wordt klaargezet…</p>;
 return <article className={styles.reading}><p className={styles.mark}>{reading.watermark}</p><h2>{reading.title}</h2><div dangerouslySetInnerHTML={{__html:reading.accessibleHtml}}/></article>;
}
