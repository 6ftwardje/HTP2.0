import 'server-only';
import {createClient} from '@/lib/supabase/server';
export type AcademyRubric={id:string;title:string;slug:string;description:string;sort_order:number;is_published:boolean;version:number};
export async function publishedRubrics():Promise<AcademyRubric[]>{
 const db=await createClient();const {data,error}=await db.from('academy_rubrics').select('*').eq('is_published',true).order('sort_order').order('id');
 if(error){if(['42P01','PGRST205'].includes(error.code))return [];throw Error('De Academy-rubrieken konden niet worden geladen.');}
 return (data??[]) as AcademyRubric[];
}
export async function rubricBySlug(slug:string){
 const db=await createClient(),{data,error}=await db.from('academy_rubrics').select('*').eq('is_published',true).eq('slug',slug).maybeSingle();
 if(error)throw Error('De Academy-rubriek kon niet worden geladen.');if(!data)return null;
 const mapping=await db.from('academy_rubric_modules').select('module_id').eq('rubric_id',data.id);if(mapping.error)throw Error('De modulekoppeling kon niet worden geladen.');
 return {rubric:data as AcademyRubric,moduleIds:(mapping.data??[]).map(x=>Number(x.module_id))};
}
