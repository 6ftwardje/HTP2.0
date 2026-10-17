import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ProtectedContentNotFound() {
  return <div>
    <PageHeader title="Deze inhoud is niet beschikbaar"
      description="Controleer de link of ga naar je dashboard om verder te gaan."/>
    <Link href="/dashboard" className="cb-btn cb-btn-secondary">Naar dashboard</Link>
  </div>;
}
