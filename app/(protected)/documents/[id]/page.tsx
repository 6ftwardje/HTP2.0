import {notFound} from 'next/navigation';
import {authorizedPdf} from '@/lib/pdf/http';
import {ProtectedPdfViewer} from '@/components/ProtectedPdfViewer';
import {PageHeader} from '@/components/layout/PageHeader';
export default async function DocumentPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;let context;try{context=await authorizedPdf(id);}catch{notFound();}
 return <><PageHeader title={context.document.title} description={`${context.document.page_count} pagina’s · Persoonlijke leesweergave`}/><ProtectedPdfViewer documentId={id} viewerId={context.student.id}/></>;
}
