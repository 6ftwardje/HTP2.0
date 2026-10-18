import 'server-only';
import {createClient} from '@/lib/supabase/server';
import type {FeedUpdate} from '@/lib/market-feed';
export type PdfListing = {
 id:string; title:string; description:string; page_count:number; version:string;
 shelf:'course'|'toolbox'; sort_order:number; has_cover:boolean; reading_available:boolean;
 module_id:number|null; weekly_update_id:number|null;
};
/** Safe SQL projection: never returns source paths or the complete reading content. */
export async function visibleDocuments(kind:'update'|'module',parents:number[]):Promise<PdfListing[]> {
 if(!parents.length)return [];
 const db=await createClient(),rows:PdfListing[]=[];
 for(let start=0;start<parents.length;start+=100){
  for(let offset=0;;offset+=250){
   const {data,error}=await db.rpc('list_visible_pdf_documents',{p_kind:kind,p_parent_ids:parents.slice(start,start+100)}).range(offset,offset+249);
   if(error)throw Error('De documenten konden niet worden geladen. Probeer opnieuw.');
   rows.push(...(data??[]) as PdfListing[]);if(!data||data.length<250)break;
  }
 }
 return rows;
}
export async function withUpdateDocuments<T extends FeedUpdate>(updates:T[],viewerId:string){
 try{const documents=await visibleDocuments('update',updates.map(x=>x.id));return updates.map(x=>({...x,pdfViewerId:viewerId,documents:documents.filter(d=>d.weekly_update_id===x.id)}));}
 catch{return updates.map(x=>({...x,pdfViewerId:viewerId,documents:[],documentsUnavailable:true}));}
}
