import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { ChatAttachmentError, CHAT_ATTACHMENT_MAX_BYTES, processChatScreenshot, readChatAttachmentForm } from "@/lib/chat-attachments-process";
import { storeChatAttachment } from "@/lib/chat-attachments-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 403 });
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Log opnieuw in om een screenshot toe te voegen." }, { status: 401 });
    const form = await readChatAttachmentForm(request);
    const file = form.get("file");
    const intent = form.get("upload_intent"); const thread = form.get("thread_id");
    if (!(file instanceof File) || form.getAll("file").length !== 1) throw new ChatAttachmentError("Kies één screenshot.");
    if (file.size > CHAT_ATTACHMENT_MAX_BYTES) throw new ChatAttachmentError("Kies een screenshot van maximaal 4 MB.", 413);
    if (typeof intent !== "string" || !UUID.test(intent) || (thread !== null && (typeof thread !== "string" || !UUID.test(thread)))) {
      throw new ChatAttachmentError("Deze upload hoort niet bij een geldig concept. Kies het bestand opnieuw.");
    }
    const image = await processChatScreenshot(Buffer.from(await file.arrayBuffer()), file.name);
    const attachment = await storeChatAttachment(createServiceClient(), user.id, image,
      { uploadIntent: intent, threadId: thread as string | null });
    return NextResponse.json({ attachment }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ChatAttachmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("chat_attachment_upload_failed", { code: "unexpected" });
    return NextResponse.json({ error: "Je screenshot kon niet worden opgeslagen. Probeer opnieuw." }, { status: 500 });
  }
}
