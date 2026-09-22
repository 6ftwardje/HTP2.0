import Link from "next/link";
import { notFound } from "next/navigation";
import { paidProductsEnabled } from "@/lib/billing";
import { PageHeader } from "@/components/layout/PageHeader";

type Props = { searchParams: Promise<{ product?: string }> };

export default async function BillingSuccessPage({ searchParams }: Props) {
  if (!paidProductsEnabled()) notFound();
  const { product } = await searchParams;
  const academy = product === "academy";
  return (
    <div>
      <PageHeader
        eyebrow="Betaling ontvangen"
        title={academy ? "Welkom bij de Academy" : "Welkom bij de subscription"}
        description="Stripe verwerkt je betaling en activeert je toegang via een beveiligde webhook. Dit gebeurt normaal binnen enkele seconden."
      />
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-7 sm:p-9">
        <h2 className="cb-section-title">Je toegang wordt klaargezet</h2>
        <p className="mt-3 cb-body">
          {academy
            ? "Je lifetime Academy-toegang en drie maanden subscriptionbonus worden nu geactiveerd. Zie je nog een slot, vernieuw de pagina dan na enkele seconden."
            : "Je kunt nu naar de marktupdates gaan. Zie je nog een slot, vernieuw de pagina dan na enkele seconden."}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={academy ? "/modules" : "/updates/forex"} className="cb-btn cb-btn-primary">
            {academy ? "Open Academy" : "Bekijk marktupdates"}
          </Link>
          <Link href="/account" className="cb-btn cb-btn-secondary">
            Bekijk abonnement
          </Link>
        </div>
      </section>
    </div>
  );
}
