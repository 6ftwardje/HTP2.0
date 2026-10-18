import 'server-only';
import {createClient} from '@/lib/supabase/server';
export type ToolboxResource={id:string;module_id:number;title:string;description:string;kind:'link'|'file';url:string|null;filename:string|null;byte_size:number|null;sort_order:number};
export async function visibleToolboxResources(ids:number[]){
 const rows:ToolboxResource[]=[];if(!ids.length)return rows;const db=await createClient();
 for(let start=0;start<ids.length;start+=100)for(let offset=0;;offset+=250){const {data,error}=await db.rpc('list_visible_toolbox_resources',{p_modules:ids.slice(start,start+100)}).range(offset,offset+249);if(error)throw Error('De Toolbox kon niet worden geladen. Probeer opnieuw.');rows.push(...(data??[]) as ToolboxResource[]);if(!data||data.length<250)break;}
 return rows;
}
