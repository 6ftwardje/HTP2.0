import 'server-only';
import {createClient} from '@/lib/supabase/server';
import type {FeedUpdate} from '@/lib/market-feed';
import {logError} from '@/lib/logger';
import {queryVisibleDocuments,type PdfListing} from './catalog-query';
export type {PdfListing} from './catalog-query';
/** Safe SQL projection: never returns source paths or the complete reading content. */
export async function visibleDocuments(kind:'update'|'module',parents:number[]):Promise<PdfListing[]> {
 if(!parents.length)return [];
 const db=await createClient();
 return queryVisibleDocuments(db,kind,parents);
}
export async function withUpdateDocuments<T extends FeedUpdate>(updates:T[],viewerId:string){
 try{const documents=await visibleDocuments('update',updates.map(x=>x.id));return updates.map(x=>({...x,pdfViewerId:viewerId,documents:documents.filter(d=>d.weekly_update_id===x.id)}));}
 catch(error){logError('market.attachments.unavailable',error,{viewerId,postIds:updates.map(x=>x.id)});return updates.map(x=>({...x,pdfViewerId:viewerId,documents:[],documentsUnavailable:true}));}
}
