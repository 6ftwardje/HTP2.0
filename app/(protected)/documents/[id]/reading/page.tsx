import {notFound} from 'next/navigation';
import {authorizedPdf} from '@/lib/pdf/http';
import {PageHeader} from '@/components/layout/PageHeader';
import {AccessiblePdfReader} from '@/components/AccessiblePdfReader';
export default async function PdfReadingPage({params}:{params:Promise<{id:string}>}){const {id}=await params;let context;try{context=await authorizedPdf(id);}catch{notFound();}return <><PageHeader title="Toegankelijke leesversie" description="Dezelfde inhoud en toegangsrechten, met selecteerbare tekst en je persoonlijke markering."/><AccessiblePdfReader documentId={id} viewerId={context.student.id}/></>;}
