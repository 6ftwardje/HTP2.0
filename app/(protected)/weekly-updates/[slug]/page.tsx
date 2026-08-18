import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function WeeklyUpdateDetailPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/market-analysis/${slug}`);
}
