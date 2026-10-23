import { redirect } from "next/navigation";
import StudentAuthForm from "@/components/auth/StudentAuthFormLegacy";

export default async function HomePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (typeof params.code === "string") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
    }
    redirect(`/auth/callback?${query}`);
  }
  return <StudentAuthForm />;
}
