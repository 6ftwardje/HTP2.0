import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanupAvatars } from "@/lib/avatars/lifecycle";

// Optional authenticated scheduler endpoint; every successful mutation also cleans up.
export async function POST(request: Request) {
  const expected = process.env.AVATAR_CLEANUP_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const target = `Bearer ${expected}`;
  if (!expected || supplied.length !== target.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(target))) return new NextResponse(null, { status: 401 });
  try { await cleanupAvatars(createServiceClient()); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ error: "Cleanup failed" }, { status: 500 }); }
}
