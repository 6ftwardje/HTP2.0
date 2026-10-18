import { ProductBoard } from "@/components/admin/ProductBoard";
import { getProductBoard } from "@/lib/admin/product-board";

export const dynamic = "force-dynamic";

export default async function ProductBoardPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const [data, params] = await Promise.all([getProductBoard(), searchParams]);
  const board = params.board === "team" ? "team" : "development";
  return <ProductBoard key={board} board={board} {...data} />;
}
