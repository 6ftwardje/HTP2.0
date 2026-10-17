import { redirect } from "next/navigation";
import { withLegacyMarketQuery, type LegacyMarketSearchParams } from "@/lib/legacy-market-redirect";
export default async function UpdatesPage({ searchParams }: { searchParams?: Promise<LegacyMarketSearchParams> }) {
  redirect(withLegacyMarketQuery("/market-analysis", searchParams ? await searchParams : {}));
}
