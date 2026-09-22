import { PageHeader } from "@/components/layout/PageHeader";
import { MarketInsightLibrary } from "@/components/market-insight/MarketInsightLibrary";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";
import { canAccessSubscriberContent, getBillingOverview, paidProductsEnabled } from "@/lib/billing";
import { ensureCurrentStudent } from "@/lib/students";
import { listPublishedWeeklyUpdates } from "@/lib/weekly-updates";

export default async function MarketAnalysisPage() {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const billing = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, billing)) {
    if (!paidProductsEnabled()) notFound();
    return <SubscriptionPaywall overview={billing} title="Ontgrendel Marktinzicht" />;
  }
  const updates = await listPublishedWeeklyUpdates(100);
  return (
    <div>
      <PageHeader
        eyebrow="Voorbereiden · Begrijpen · Deelnemen"
        title="Marktinzicht"
        description="Bereid je voor op de week, begrijp actuele marktbewegingen en neem deel aan live analyses."
      />
      <MarketInsightLibrary updates={updates} />
    </div>
  );
}
import { notFound } from "next/navigation";
