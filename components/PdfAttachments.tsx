import type {PdfListing} from '@/lib/pdf/catalog';
import {ProtectedPdfViewer} from '@/components/ProtectedPdfViewer';
export function PdfAttachments({documents,viewerId,unavailable=false,compact=false}:{documents:PdfListing[];viewerId:string;unavailable?:boolean;compact?:boolean}){
 if(unavailable)return <p role="status" className="p-4 text-sm text-[var(--muted)]">Bijlagen konden niet worden geladen. Vernieuw de pagina om opnieuw te proberen.</p>;
 if(!documents.length)return null;
 return <ul aria-label="PDF-bijlagen" className={compact?'divide-y divide-[var(--border)]':'grid gap-5 sm:grid-cols-2'}>{documents.map(doc=><li key={doc.id} className="flex min-w-0 gap-4 p-4">
  {doc.has_cover?<img src={`/api/documents/${doc.id}/cover`} alt="" className="h-24 w-16 shrink-0 rounded object-cover"/>:<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-1 h-10 w-8 shrink-0 text-[var(--muted)]"><path d="M5 3h9l5 5v13H5Z M14 3v6h5 M8 13h8 M8 17h6"/></svg>}
  <div className="min-w-0 flex-1"><h3 className="break-words text-base font-semibold">{doc.title}</h3>{doc.description?<p className="mt-1 max-w-prose break-words text-sm text-[var(--muted)]">{doc.description}</p>:null}<p className="mb-3 mt-1 text-sm text-[var(--muted)]">PDF · {doc.page_count} {doc.page_count===1?'pagina':'pagina’s'}</p><div className="flex flex-wrap gap-2"><ProtectedPdfViewer documentId={doc.id} viewerId={viewerId} label={`Openen: ${doc.title}`} hasReading={doc.reading_available}/></div></div>
 </li>)}</ul>;
}
