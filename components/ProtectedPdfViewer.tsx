"use client";
import Link from 'next/link';
import {usePdfPosition} from '@/lib/use-pdf-position';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,PDFDocumentLoadingTask,RenderTask} from 'pdfjs-dist';
import styles from './ProtectedPdfViewer.module.css';
type Metadata={viewerId:string;title:string;pageCount:number;version:string;state:string;readingAvailable:boolean;accessibleHtml?:string};
type Size={width:number;height:number};
class PdfViewError extends Error {}
export function ProtectedPdfViewer({documentId,viewerId,label='Open document',hasReading=true}:{documentId:string;viewerId:string;label?:string;hasReading?:boolean}){
 const [open,setOpen]=useState(false),[attempt,setAttempt]=useState(0),[status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle'),[error,setError]=useState(''),[metadata,setMetadata]=useState<Metadata|null>(null),[watermark,setWatermark]=useState(''),[sizes,setSizes]=useState<Size[]>([]),[current,setCurrent]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(640),[mode,setMode]=useState<'canvas'|'text'>('canvas'),[rendering,setRendering]=useState(false),[pageInput,setPageInput]=useState('1');
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),viewport=useRef<HTMLDivElement>(null),slots=useRef<(HTMLDivElement|null)[]>([]),pdf=useRef<PDFDocumentProxy|null>(null),loadingTask=useRef<PDFDocumentLoadingTask|null>(null),tasks=useRef(new Set<RenderTask>()),chain=useRef<Promise<void>>(Promise.resolve()),requestId=useRef(''),lastVersion=useRef('');
 const clear=useCallback(()=>{for(const task of tasks.current)task.cancel();for(const canvas of dialog.current?.querySelectorAll('canvas')??[]){canvas.width=0;canvas.height=0;canvas.remove();}},[]);
 useEffect(()=>{
  if(!open)return;const node=dialog.current;if(!node)return;node.showModal();const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';node.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  return()=>{node.close();document.body.style.overflow=priorOverflow;trigger.current?.focus();};
 },[open]);
 useEffect(()=>{
  if(!open)return;const abort=new AbortController();setStatus('loading');setMetadata(null);setError('');setSizes([]);setCurrent(1);setZoom(1);setMode('canvas');
  async function load(){
   const response=await fetch(`/api/documents/${documentId}`,{signal:abort.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw new PdfViewError(data.error??'Dit document is niet beschikbaar.');if(data.viewerId!==viewerId)throw new PdfViewError('Je account is gewijzigd. Vernieuw de pagina.');
   const meta=data as Metadata;if(lastVersion.current&&lastVersion.current!==meta.version)requestId.current=crypto.randomUUID();lastVersion.current=meta.version;
   const [opened,pdfjs]=await Promise.all([fetch(`/api/documents/${documentId}/open`,{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({viewerId,version:meta.version,requestId:requestId.current})}),import('pdfjs-dist')]);
   if(!opened.ok){const failure=await opened.json();throw new PdfViewError(failure.error??'Het document kon niet worden geopend.');}if(opened.headers.get('X-PDF-Viewer')!==viewerId||opened.headers.get('X-PDF-Version')!==meta.version)throw new PdfViewError('Je account of het document is gewijzigd. Open opnieuw.');
   const bytes=await opened.arrayBuffer();if(abort.signal.aborted)return;
   if(meta.readingAvailable){const readingResponse=await fetch(`/api/documents/${documentId}/open`,{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({viewerId,version:meta.version,requestId:requestId.current,mode:'reading'})});const reading=await readingResponse.json();if(!readingResponse.ok||reading.viewerId!==viewerId||reading.version!==meta.version)throw new PdfViewError(reading.error??'De leesversie is gewijzigd. Open opnieuw.');meta.accessibleHtml=reading.accessibleHtml;}
   if(abort.signal.aborted)return;pdfjs.GlobalWorkerOptions.workerSrc='/pdf-assets/pdf.worker.mjs';
   const task=pdfjs.getDocument({data:new Uint8Array(bytes),standardFontDataUrl:'/pdf-assets/standard_fonts/',wasmUrl:'/pdf-assets/wasm/',enableXfa:false,stopAtErrors:true,canvasMaxAreaInBytes:8*1024*1024});loadingTask.current=task;
   const document=await task.promise;if(abort.signal.aborted){await task.destroy();return;}if(document.numPages!==meta.pageCount)throw new PdfViewError('De PDF-versie klopt niet. Vraag de beheerder om herstel.');pdf.current=document;
   const dimensions:Size[]=[];for(let n=1;n<=document.numPages;n++){if(abort.signal.aborted)return;const page=await document.getPage(n);const box=page.getViewport({scale:1});dimensions.push({width:box.width,height:box.height});page.cleanup();}
   if(abort.signal.aborted)return;setMetadata(meta);setWatermark(decodeURIComponent(opened.headers.get('X-PDF-Watermark')??''));setSizes(dimensions);setStatus('ready');
  }
  void load().catch(reason=>{if(!abort.signal.aborted){clear();void loadingTask.current?.destroy();pdf.current=null;setStatus('error');setError(reason instanceof PdfViewError?reason.message:'Het document kon niet worden geladen. Controleer je verbinding of vraag de beheerder om herstel.');}});
  return()=>{abort.abort();clear();void loadingTask.current?.destroy();loadingTask.current=null;pdf.current=null;};
 },[open,attempt,documentId,viewerId,clear]);
 useEffect(()=>{if(!open||!viewport.current)return;const node=viewport.current;const observer=new ResizeObserver(()=>setWidth(node.clientWidth));observer.observe(node);setWidth(node.clientWidth);return()=>observer.disconnect();},[open]);
 useEffect(()=>{
  if(!open||status!=='ready')return;const abort=new AbortController();
  async function check(){if(document.visibilityState!=='visible')return;try{const response=await fetch(`/api/documents/${documentId}`,{cache:'no-store',signal:abort.signal});const data=await response.json();if(!response.ok||data.viewerId!==viewerId||data.version!==metadata?.version){clear();void loadingTask.current?.destroy();pdf.current=null;setStatus('error');setError('Je toegang, account of document is gewijzigd. Vernieuw de pagina.');}}catch{/* A temporary network failure is retried on the next explicit open. */}}
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);return()=>{abort.abort();window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
 },[open,status,documentId,viewerId,metadata?.version,clear]);
 useEffect(()=>{
  if(!open||status!=='ready'||mode!=='canvas')return;let cancelled=false;clear();setRendering(true);
  chain.current=chain.current.catch(()=>{}).then(async()=>{
   const pdfDoc=pdf.current;if(cancelled||!pdfDoc)return;
   for(let n=Math.max(1,current-1);n<=Math.min(pdfDoc.numPages,current+1);n++){
    const page=await pdfDoc.getPage(n);if(cancelled||!pdf.current){page.cleanup();return;}const host=slots.current[n-1];if(!host)return;
    const box=page.getViewport({scale:Math.min(1.5,Math.max(1,width-32)/sizes[n-1].width)*zoom});const ratio=Math.min(devicePixelRatio,Math.sqrt(2000000/(box.width*box.height)));
    const canvas=document.createElement('canvas');canvas.width=Math.floor(box.width*ratio);canvas.height=Math.floor(box.height*ratio);canvas.style.width=`${box.width}px`;canvas.style.height=`${box.height}px`;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Pagina ${n}; gebruik de leesversie voor toegankelijke tekst`);host.append(canvas);
    const task=page.render({canvas,viewport:box,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0],annotationMode:0});tasks.current.add(task);try{await task.promise;}finally{tasks.current.delete(task);page.cleanup();}
   }
   if(!cancelled)setRendering(false);
  }).catch(reason=>{if(!cancelled&&reason?.name!=='RenderingCancelledException'){setError('Deze pagina kon niet worden weergegeven. Probeer opnieuw of vraag de beheerder om herstel.');setStatus('error');}});
  return()=>{cancelled=true;clear();};
 },[open,status,mode,current,width,zoom,sizes,clear]);
 useEffect(()=>setPageInput(String(current)),[current]);
 function go(page:number){const next=Math.max(1,Math.min(sizes.length,page));setCurrent(next);setPageInput(String(next));slots.current[next-1]?.scrollIntoView({block:'start'});}
 function rescale(value:number){setZoom(Math.max(.5,Math.min(2,value)));requestAnimationFrame(()=>slots.current[current-1]?.scrollIntoView({block:'start'}));}
 const position=usePdfPosition({documentId,viewerId,version:metadata?.version??null,active:open&&status==='ready',page:current,onRestore:go});
 const scrollTick=useRef<number|null>(null);
 function scroll(){if(scrollTick.current!==null||mode!=='canvas')return;scrollTick.current=requestAnimationFrame(()=>{scrollTick.current=null;const bounds=viewport.current?.getBoundingClientRect();if(!bounds)return;let best=current,area=0;slots.current.forEach((slot,i)=>{if(!slot)return;const box=slot.getBoundingClientRect();const visible=Math.max(0,Math.min(box.bottom,bounds.bottom)-Math.max(box.top,bounds.top));if(visible>area){area=visible;best=i+1;}});setCurrent(best);});}
 useEffect(()=>()=>{if(scrollTick.current!==null)cancelAnimationFrame(scrollTick.current);},[]);
 return <><button ref={trigger} type="button" className="cb-btn cb-btn-primary" onClick={()=>{requestId.current=crypto.randomUUID();lastVersion.current='';setOpen(true);}}>{label}</button> {hasReading?<Link href={`/documents/${documentId}/reading`} prefetch={false} className="cb-btn cb-btn-secondary">Leesversie openen</Link>:null}
 <dialog ref={dialog} className={styles.dialog} aria-labelledby={`pdf-title-${documentId}`} data-protected-pdf data-rendering={rendering} onCancel={event=>{event.preventDefault();setOpen(false);}}
  onContextMenu={event=>{if(mode==='canvas'&&(event.target as HTMLElement).closest(`.${styles.pages}`))event.preventDefault();}} onDragStart={event=>{if(mode==='canvas')event.preventDefault();}}
  onKeyDown={event=>{const target=event.target as HTMLElement;if(mode==='canvas'&&(event.ctrlKey||event.metaKey)&&['s','p','c'].includes(event.key.toLowerCase())&&!target.closest('input,textarea,select,[contenteditable="true"]'))event.preventDefault();}}>
  <header className={styles.header}><h2 id={`pdf-title-${documentId}`}>{metadata?.title??'Document openen'}</h2><button data-close type="button" onClick={()=>setOpen(false)}>Sluiten</button></header>
  <div className={styles.controls}><div className={styles.toolbar} aria-label="Documentbediening">
   <button type="button" disabled={status!=='ready'||mode==='text'||current<=1} aria-label="Vorige pagina" onClick={()=>go(current-1)}>Vorige</button><label>Pagina <input aria-label="Paginanummer" type="number" min={1} max={sizes.length||1} value={pageInput} disabled={status!=='ready'||mode==='text'} onChange={event=>setPageInput(event.target.value)} onBlur={()=>{const n=Number(pageInput);if(Number.isSafeInteger(n)&&n>0)go(n);else setPageInput(String(current));}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();const n=Number(pageInput);if(Number.isSafeInteger(n)&&n>0)go(n);else setPageInput(String(current));}}}/></label><span aria-live="polite">/ {sizes.length||'…'}</span><button type="button" disabled={status!=='ready'||mode==='text'||current>=sizes.length} aria-label="Volgende pagina" onClick={()=>go(current+1)}>Volgende</button>
   <button type="button" disabled={status!=='ready'||mode==='text'||zoom<=.5} aria-label="Uitzoomen" onClick={()=>rescale(zoom-.25)}>−</button><span>{Math.round(zoom*100)}%</span><button type="button" disabled={status!=='ready'||mode==='text'||zoom>=2} aria-label="Inzoomen" onClick={()=>rescale(zoom+.25)}>+</button><button type="button" disabled={status!=='ready'||mode==='text'} onClick={()=>rescale(1)}>Passend</button><button type="button" disabled={status!=='ready'||mode==='text'||position.state!=='idle'} onClick={position.restart}>Opnieuw beginnen</button>
   <label className={styles.mode}>Weergave <select aria-label="Leesweergave" value={mode} disabled={status!=='ready'} onChange={event=>{clear();setMode(event.target.value as 'canvas'|'text');viewport.current?.scrollTo(0,0);}}><option value="canvas">Pagina’s</option><option value="text" disabled={!metadata?.readingAvailable}>Toegankelijke leesversie</option></select></label>
  </div>
  {position.message?<div className={styles.position} role="status"><span>{position.message}</span>{position.state==='error'?<button type="button" onClick={position.retry}>Positie opnieuw proberen</button>:null}{position.state==='conflict'?<><button type="button" onClick={position.reload}>Andere positie laden</button><button type="button" onClick={position.overwrite}>Mijn pagina bewaren</button></>:null}</div>:null}</div>
  <div ref={viewport} className={styles.viewport} tabIndex={0} aria-label="Documentinhoud" onScroll={scroll}>
   {status==='loading'?<p role="status" className={styles.message}>Je persoonlijke document wordt klaargezet…</p>:null}
   {status==='error'?<div className={styles.message}><p role="alert">{error}</p><p><Link href={`/documents/${documentId}/reading`} prefetch={false}>Open de toegankelijke leesversie zonder PDF-speler</Link></p><button type="button" onClick={()=>setAttempt(value=>value+1)}>Opnieuw proberen</button> <button type="button" onClick={()=>location.reload()}>Pagina vernieuwen</button></div>:null}
   {status==='ready'&&mode==='canvas'?<div className={styles.pages}>{sizes.map((size,i)=>{const scale=Math.min(1.5,Math.max(1,width-32)/size.width)*zoom;return <div className={styles.page} data-page={i+1} key={i} ref={node=>{slots.current[i]=node;}} style={{width:size.width*scale,height:size.height*scale}}/>;})}</div>:null}
   {status==='ready'&&mode==='text'?<article className={styles.reading}><p className={styles.mark}>{watermark}</p><h2>{metadata?.title}</h2><div dangerouslySetInnerHTML={{__html:metadata?.accessibleHtml??''}}/></article>:null}
  </div>
  <footer className={styles.footer}>Persoonlijk watermerk. Screenshots en kopiëren blijven technisch mogelijk.</footer>
 </dialog></>;
}
