import { notFound, redirect } from "next/navigation";
import { MARKET_OPTIONS } from "@/lib/market-analysis";

type Props = { params: Promise<{ market: string }> };

export default async function LegacyMarketUpdatesPage({ params }: Props) {
  const { market } = await params;
  if (!MARKET_OPTIONS.some((option) => option.value === market)) notFound();

  redirect(`/market-analysis?market=${encodeURIComponent(market)}`);
}
