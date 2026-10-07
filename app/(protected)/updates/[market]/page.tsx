import { notFound } from "next/navigation";
import { MarketUpdatesLibrary } from "@/components/updates/MarketUpdatesLibrary";
import { MARKET_OPTIONS } from "@/lib/market-analysis";
import type { Market } from "@/lib/types";
import { listPublishedMarketUpdatesByMarket } from "@/lib/weekly-updates";
import { ensureCurrentStudent } from "@/lib/students";
import {
  canAccessSubscriberContent,
  getBillingOverview,
  paidProductsEnabled,
} from "@/lib/billing";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";

type Props = { params: Promise<{ market: string }> };

export default async function MarketUpdatesPage({ params }: Props) {
  const { market: marketParam } = await params;
  const market = MARKET_OPTIONS.some(({ value }) => value === marketParam)
    ? (marketParam as Market)
    : null;

  if (!market) notFound();

  const { student } = await ensureCurrentStudent();
  if (!student) return null;
  const billingOverview = await getBillingOverview(student.id);
  const hasSubscriberAccess = canAccessSubscriberContent(student, billingOverview);
  const updates = await listPublishedMarketUpdatesByMarket(market, 60, {
    freeOnly: !hasSubscriberAccess,
  });
  if (!hasSubscriberAccess && updates.length === 0 && paidProductsEnabled()) {
    return <SubscriptionPaywall overview={billingOverview} title={`Ontgrendel alle ${MARKET_OPTIONS.find((option) => option.value === market)?.label ?? "markt"}-updates`} />;
  }

  return <MarketUpdatesLibrary market={market} updates={updates} />;
}
