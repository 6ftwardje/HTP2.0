import {requireAdmin} from '@/lib/admin/access';
import {PageHeader} from '@/components/layout/PageHeader';
import {PdfDocumentsManager} from '@/components/admin/PdfDocumentsManager';
export default async function PdfAdminPage(){await requireAdmin();return <><PageHeader title="PDF-beheer" description="Documenten, gecontroleerde leesversies en persoonlijke openacties."/><PdfDocumentsManager/></>;}
