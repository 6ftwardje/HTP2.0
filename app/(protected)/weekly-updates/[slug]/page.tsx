import { redirect } from "next/navigation";
import { withLegacyMarketQuery, type LegacyMarketSearchParams } from "@/lib/legacy-market-redirect";
export default async function WeeklyUpdateDetailPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams?: Promise<LegacyMarketSearchParams>;
}) {
  const { slug } = await params;
  redirect(withLegacyMarketQuery("/market-analysis/" + encodeURIComponent(slug), searchParams ? await searchParams : {}));
}
