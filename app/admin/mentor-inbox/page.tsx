import { redirect } from "next/navigation";

export default async function LegacyMentorInboxPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const values = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === "string") params.set(key, value);
  redirect(`/mentor-inbox${params.size ? `?${params}` : ""}`);
}
