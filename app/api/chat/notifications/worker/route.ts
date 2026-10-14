import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runChatMaintenance } from "@/lib/chat-notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = process.env.CHAT_MAINTENANCE_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return NextResponse.json(await runChatMaintenance(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error(JSON.stringify({ event: "chat.notifications.worker_failed" }));
    return NextResponse.json({ error: "Chatmeldingen verwerken mislukt." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
