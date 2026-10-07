import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET, avatarPathIsValid } from "@/lib/avatars/lifecycle";

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!avatarPathIsValid(path)) return new NextResponse(null, { status: 404 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  // User client + storage RLS: only self/accessible post author, never service role.
  const { data, error } = await db.storage.from(AVATAR_BUCKET).download(path);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff", Vary: "Cookie" } });
}
