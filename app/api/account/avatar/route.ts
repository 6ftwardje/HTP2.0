import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { processAvatar, AVATAR_SOURCE_MAX_BYTES, type AvatarCrop } from "@/lib/avatars/process";
import { AvatarPersistenceError, cleanupAvatars, storeAvatar } from "@/lib/avatars/lifecycle";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

async function identity() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.from("students").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (error) throw error;
  return data ? { userId: user.id, studentId: data.id as string } : null;
}

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 403 });
  let current: Awaited<ReturnType<typeof identity>>;
  try { current = await identity(); }
  catch (error) {
    logError("profile_avatar_save_failed", error, { operation: "identity" });
    return NextResponse.json({ error: "Je foto kon niet worden opgeslagen. Probeer opnieuw." }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: "Log opnieuw in om je foto te wijzigen." }, { status: 401 });
  // Enforce an actual byte limit while reading, including requests without Content-Length.
  const limit = AVATAR_SOURCE_MAX_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit) return NextResponse.json({ error: "Kies een foto van maximaal 5 MB." }, { status: 413 });
  let bytes: Buffer;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Kies een foto.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.length;
      if (size > limit) { await reader.cancel(); return NextResponse.json({ error: "Kies een foto van maximaal 5 MB." }, { status: 413 }); }
      chunks.push(next.value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("photo");
    if (!(file instanceof File) || file.size > AVATAR_SOURCE_MAX_BYTES) throw new Error("Kies een foto van maximaal 5 MB.");
    let crop: AvatarCrop;
    try { crop = JSON.parse(String(form.get("crop"))) as AvatarCrop; }
    catch { throw new Error("Controleer de uitsnede en probeer opnieuw."); }
    bytes = await processAvatar(Buffer.from(await file.arrayBuffer()), crop);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kies een geldige afbeelding." }, { status: 400 });
  }
  try {
    const path = await storeAvatar(createServiceClient(), current, bytes, `${current.userId}/${randomUUID()}.webp`);
    return NextResponse.json({ objectPath: path });
  } catch (error) {
    logError("profile_avatar_save_failed", error instanceof AvatarPersistenceError ? error.cause : error, {
      operation: error instanceof AvatarPersistenceError ? error.operation : "configuration",
    });
    return NextResponse.json({ error: error instanceof AvatarPersistenceError ? error.message : "Je foto kon niet worden opgeslagen. Probeer opnieuw." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 403 });
  try {
    const current = await identity();
    if (!current) return NextResponse.json({ error: "Log opnieuw in om je foto te verwijderen." }, { status: 401 });
    const db = createServiceClient();
    const { error } = await db.rpc("commit_student_avatar", { p_auth_uid: current.userId, p_path: null });
    if (error) throw error;
    await cleanupAvatars(db).catch((error) => console.error("avatar cleanup", error.message));
    return NextResponse.json({ objectPath: null });
  } catch (error) {
    logError("profile_avatar_delete_failed", error);
    return NextResponse.json({ error: "Je foto kon niet worden verwijderd. Probeer opnieuw." }, { status: 500 });
  }
}
