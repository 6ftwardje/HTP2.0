import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { CHAT_ATTACHMENT_BUCKET, chatAttachmentPathIsValid, removePendingChatAttachment } from "@/lib/chat-attachments-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };
const PRIVATE_IMAGE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer", "Vary": "Cookie, Authorization", "Cross-Origin-Resource-Policy": "same-origin",
};
const imageFailure = (status: number) => new NextResponse(null, { status, headers: PRIVATE_IMAGE_HEADERS });

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return imageFailure(404);
  try {
    const db = await createClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) return imageFailure(401);
    const service = createServiceClient();
    const allowed = await service.rpc("get_chat_attachment_download", { p_auth_uid: user.id, p_attachment_id: id });
    if (allowed.error || !allowed.data || !chatAttachmentPathIsValid(allowed.data.objectPath)) return imageFailure(404);
    const image = await service.storage.from(CHAT_ATTACHMENT_BUCKET).download(allowed.data.objectPath);
    if (image.error || !image.data) return imageFailure(404);
    // Recheck after fetching bytes so revoked participation during an in-flight
    // storage request does not use the earlier authorization result.
    const stillAllowed = await service.rpc("get_chat_attachment_download", { p_auth_uid: user.id, p_attachment_id: id });
    if (stillAllowed.error) return imageFailure(404);
    const name = encodeURIComponent(allowed.data.fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new NextResponse(image.data, { headers: {
      ...PRIVATE_IMAGE_HEADERS, "Content-Type": "image/webp",
      "Content-Disposition": `inline; filename="screenshot.webp"; filename*=UTF-8''${name}`,
    } });
  } catch {
    console.error("chat_attachment_download_failed", { code: "unexpected" });
    return imageFailure(500);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  try {
    const db = await createClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) return new NextResponse(null, { status: 401 });
    const discarded = await db.rpc("discard_chat_attachment", { p_attachment_id: id });
    if (discarded.error) return NextResponse.json({ error: "Deze afbeelding kan niet worden verwijderd." }, { status: 404 });
    await removePendingChatAttachment(createServiceClient(), id);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("chat_attachment_delete_failed", { code: "unexpected" });
    return NextResponse.json({ error: "Verwijderen is niet bevestigd. Probeer opnieuw." }, { status: 500 });
  }
}
