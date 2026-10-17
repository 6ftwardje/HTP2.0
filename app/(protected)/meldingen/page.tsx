import { redirect } from "next/navigation";
export default async function MeldingenAlias({ searchParams }: {searchParams?:Promise<{page?:string}>}) {
  const params=searchParams?await searchParams:{};
  const page=Number(params.page);
  redirect("/notifications"+(Number.isInteger(page)&&page>1?"?page="+page:""));
}
