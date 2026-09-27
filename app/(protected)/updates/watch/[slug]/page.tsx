import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function LegacyMarketUpdateVideoPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/market-analysis/${encodeURIComponent(slug)}`);
}
