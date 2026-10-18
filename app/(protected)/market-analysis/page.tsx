import {withUpdateDocuments} from "@/lib/pdf/catalog";
import { projectMarketFeedUpdates } from "@/lib/market-feed";
import { getMarketFeedAuthors } from "@/lib/market-feed-authors";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarketInsightLibrary } from "@/components/market-insight/MarketInsightLibrary";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";
import { canAccessSubscriberContent, getBillingOverview, paidProductsEnabled } from "@/lib/billing";
import { ensureCurrentStudent } from "@/lib/students";
import { listMarketUpdateRubricUpdates } from "@/lib/weekly-updates";
import { CATEGORY_OPTIONS, type UpdateCategory } from "@/lib/market-update-structure";

type Props = { searchParams: Promise<{ market?: string }> };

export default async function MarketAnalysisPage({ searchParams }: Props) {
  const { market } = await searchParams;
  const initialMarket = CATEGORY_OPTIONS.some((option) => option.value === market)
    ? (market as UpdateCategory)
    : market === "macro" ? "macro"
    : "all";
  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const billing = await getBillingOverview(student.id);
  const hasSubscriberAccess = canAccessSubscriberContent(student, billing);
  const updates = await listMarketUpdateRubricUpdates({
    freeOnly: !hasSubscriberAccess,
  });
  if (!hasSubscriberAccess && updates.length === 0 && paidProductsEnabled()) {
    return <SubscriptionPaywall overview={billing} title="Ontgrendel Marktinzicht" />;
  }
  return (
    <div>
      <PageHeader
        title="Marktinzicht"
        description="Setups, analyses, nieuws en educatie, overzichtelijk per markt."
      />
      <MarketInsightLibrary updates={await withUpdateDocuments(projectMarketFeedUpdates(updates),student.id)} authors={await getMarketFeedAuthors(updates)} initialMarket={initialMarket} />
    </div>
  );
}
