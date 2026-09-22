import { PageHeader } from "@/components/layout/PageHeader";
import { MarketInsightLibrary } from "@/components/market-insight/MarketInsightLibrary";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";
import { canAccessSubscriberContent, getBillingOverview } from "@/lib/billing";
import { listPastLiveSessions, listUpcomingLiveSessions } from "@/lib/live-sessions";
import { ensureCurrentStudent } from "@/lib/students";
import { listPublishedWeeklyUpdates } from "@/lib/weekly-updates";

export default async function MarketAnalysisPage() {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const billing = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, billing)) {
    return <SubscriptionPaywall overview={billing} title="Ontgrendel Marktinzicht" />;
  }
  const [updates, upcoming, past] = await Promise.all([
    listPublishedWeeklyUpdates(100),
    listUpcomingLiveSessions(20),
    listPastLiveSessions(40),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow="Voorbereiden · Begrijpen · Deelnemen"
        title="Marktinzicht"
        description="Bereid je voor op de week, begrijp actuele marktbewegingen en neem deel aan live analyses."
      />
      <MarketInsightLibrary updates={updates} sessions={[...upcoming, ...past]} />
    </div>
  );
}
