// No network activity until the deployment enables chat email or attachment maintenance.
export default async function handler() {
  if (process.env.CHAT_MAINTENANCE_ENABLED !== "true" && process.env.CHAT_EMAIL_MODE !== "live" && process.env.CHAT_EMAIL_MODE !== "dry_run") return new Response(null, { status: 204 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CHAT_MAINTENANCE_SECRET;
  let url: URL;
  try {
    if (!origin || !secret || secret.length < 32) return new Response(null, { status: 503 });
    url = new URL("/api/chat/notifications/worker", origin);
    if (url.protocol !== "https:") return new Response(null, { status: 503 });
  } catch { return new Response(null, { status: 503 }); }
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error("Chat maintenance failed; inspect content-free worker logs");
  return new Response(null, { status: 204 });
}
export const config = { schedule: "* * * * *" };
