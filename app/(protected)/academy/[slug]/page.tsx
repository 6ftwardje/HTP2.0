import {visibleToolboxResources} from "@/lib/toolbox";
import {ToolboxList} from "@/components/ToolboxList";
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ensureCurrentStudent} from '@/lib/students';
import {rubricBySlug} from '@/lib/academy-rubrics';
import {getPublishedModules} from '@/lib/modules';
import {getLessonCountsByModuleIds} from '@/lib/lessons';
import {getModuleAccessMap} from '@/lib/module-gate';
import {visibleDocuments} from '@/lib/pdf/catalog';
import {PdfAttachments} from '@/components/PdfAttachments';
import {PageHeader} from '@/components/layout/PageHeader';
export default async function AcademyRubricPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{tab?:string}>}){
 const [{slug},{tab},{student}]=await Promise.all([params,searchParams,ensureCurrentStudent()]);if(!student)notFound();
 const data=await rubricBySlug(slug);if(!data)notFound();
 const allModules=await getPublishedModules(),modules=allModules.filter(x=>data.moduleIds.includes(x.id));
 const [counts,access,documents,resources]=await Promise.all([getLessonCountsByModuleIds(modules.map(x=>x.id)),getModuleAccessMap(student.id,allModules),visibleDocuments('module',modules.map(x=>x.id)),visibleToolboxResources(modules.map(x=>x.id))]);
 const videoModules=modules.filter(x=>(counts.get(x.id)??0)>0),courses=documents.filter(x=>x.shelf==='course'),toolboxPdfs=documents.filter(x=>x.shelf==='toolbox');
 const tabs=[{id:'video',label:'Videocursus',shown:videoModules.length>0},{id:'pdf',label:'PDF cursussen',shown:courses.length>0},{id:'toolbox',label:'Toolbox',shown:toolboxPdfs.length>0||resources.length>0}].filter(x=>x.shown);
 const active=tabs.find(x=>x.id===tab)?.id??tabs[0]?.id;
 if(tab&&tab!==active&&active)redirect(`/academy/${slug}?tab=${active}`);
 return <div className="space-y-7"><Link href="/modules" className="inline-flex py-2 text-sm text-[var(--muted)] underline underline-offset-4">Alle modules</Link><PageHeader title={data.rubric.title} description={data.rubric.description}/>
  {tabs.length?<nav aria-label="Inhoud van de rubriek" className="flex gap-5 overflow-x-auto border-b border-[var(--border)]">{tabs.map(x=><Link key={x.id} href={`/academy/${slug}?tab=${x.id}`} aria-current={active===x.id?'page':undefined} className={`shrink-0 border-b-2 px-1 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${active===x.id?'border-[var(--accent)] text-[var(--foreground)]':'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'}`}>{x.label}</Link>)}</nav>:<p className="max-w-prose text-[var(--muted)]">Er is nog geen inhoud voor jou beschikbaar in deze rubriek. Je bestaande modules blijven bereikbaar via het moduleoverzicht.</p>}
  {active==='video'?<ul className="divide-y divide-[var(--border)]">{videoModules.map(mod=><li key={mod.id} className="flex flex-wrap items-center justify-between gap-4 py-6"><div className="min-w-0"><h2 className="text-lg font-semibold">{mod.title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{counts.get(mod.id)} lessen · {access.get(mod.id)?'Beschikbaar':'Volledige toegang nodig'}</p></div><Link href={`/modules/${mod.slug}`} className="cb-btn cb-btn-secondary">{access.get(mod.id)?'Module openen':'Module bekijken'}</Link></li>)}</ul>:null}
  {active==='pdf'?<PdfAttachments documents={courses} viewerId={student.id}/>:null}
  {active==='toolbox'?<ToolboxList documents={toolboxPdfs} resources={resources} viewerId={student.id}/>:null}
 </div>;
}
