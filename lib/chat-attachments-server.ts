import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatAttachment } from "@/lib/types";
import { ChatAttachmentError, type processChatScreenshot } from "@/lib/chat-attachments-process";

export const CHAT_ATTACHMENT_BUCKET = "mentor-chat-attachments";
export const chatAttachmentPathIsValid = (path: string) => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path);
type ProcessedScreenshot = Awaited<ReturnType<typeof processChatScreenshot>>;
type Reservation = { id: string; objectPath: string; state: string; attachment: ChatAttachment };

export function attachmentDatabaseError(error: { code?: string } | null) {
  if (error?.code === "42501") return new ChatAttachmentError("Deze afbeelding of dit gesprek is niet beschikbaar.", 403);
  if (error?.code === "53300") return new ChatAttachmentError("Je hebt veel afbeeldingen toegevoegd. Verwijder een bestand of probeer het later opnieuw.", 429);
  if (error?.code === "55000") return new ChatAttachmentError("Afbeeldingen toevoegen is tijdelijk niet beschikbaar. Probeer opnieuw.", 503);
  if (error?.code === "22023" || error?.code === "23514") return new ChatAttachmentError("Controleer je screenshot en probeer opnieuw.");
  return new ChatAttachmentError("Je screenshot kon niet worden opgeslagen. Probeer opnieuw.", 500);
}

export async function storeChatAttachment(db: SupabaseClient, userId: string, image: ProcessedScreenshot,
  context: { threadId: string | null; uploadIntent: string }): Promise<ChatAttachment> {
  const registered = await db.rpc("register_chat_attachment", {
    p_auth_uid: userId, p_upload_intent: context.uploadIntent, p_thread_id: context.threadId,
    p_object_path: `${userId}/${randomUUID()}.webp`, p_content_sha256: image.contentSha256,
    p_file_name: image.fileName, p_width: image.width, p_height: image.height, p_size_bytes: image.sizeBytes,
  });
  if (registered.error) throw attachmentDatabaseError(registered.error);
  const reservation = registered.data as Reservation | null;
  if (!reservation || !chatAttachmentPathIsValid(reservation.objectPath) || !reservation.objectPath.startsWith(`${userId}/`)) {
    throw attachmentDatabaseError(null);
  }
  if (reservation.state === "ready" || reservation.state === "attached") return reservation.attachment;
  try {
    const stored = await db.storage.from(CHAT_ATTACHMENT_BUCKET).upload(reservation.objectPath, image.bytes,
      { contentType: "image/webp", cacheControl: "0", upsert: false });
    // A simultaneous or retried identical upload may already own this path.
    // Registration binds its processed SHA-256 to the same uploader/intent.
    if (stored.error && String(stored.error.statusCode) !== "409") throw stored.error;
    const completed = await db.rpc("complete_chat_attachment_upload", { p_auth_uid: userId, p_attachment_id: reservation.id });
    if (completed.error) throw completed.error;
    return completed.data as ChatAttachment;
  } catch {
    // Never remove here: completion may have committed before its response was
    // lost. Only an uncommitted pending reservation can become garbage.
    await db.from("conversation_attachments").update({ state: "garbage" }).eq("id", reservation.id).eq("state", "pending");
    throw attachmentDatabaseError(null);
  }
}

export async function removePendingChatAttachment(db: SupabaseClient, attachmentId: string) {
  const row = await db.from("conversation_attachments").select("id,object_path,state,message_id").eq("id", attachmentId).maybeSingle();
  if (row.error) throw attachmentDatabaseError(row.error);
  if (!row.data || row.data.message_id || !["garbage", "deleted"].includes(row.data.state)
    || !chatAttachmentPathIsValid(row.data.object_path)) return;
  const removed = await db.storage.from(CHAT_ATTACHMENT_BUCKET).remove([row.data.object_path]);
  if (removed.error) return; // The maintenance worker retries the tombstone.
  const completed = await db.rpc("complete_chat_attachment_cleanup", { p_attachment_ids: [attachmentId] });
  if (completed.error) throw attachmentDatabaseError(completed.error);
}

/** Trusted maintenance only. Immutable paths and garbage state make retries safe. */
export async function cleanupChatAttachments(db: SupabaseClient): Promise<{ removed: number }> {
  const claimed = await db.rpc("claim_chat_attachment_garbage", { p_limit: 100 });
  if (claimed.error) throw new Error("Chat attachment cleanup claim failed.");
  const rows = ((claimed.data ?? []) as Array<{ id: string | null; object_path: string }>)
    .filter((row) => chatAttachmentPathIsValid(row.object_path));
  if (!rows.length) return { removed: 0 };
  const removed = await db.storage.from(CHAT_ATTACHMENT_BUCKET).remove(rows.map((row) => row.object_path));
  if (removed.error) throw new Error("Chat attachment cleanup storage removal failed.");
  const ids = rows.flatMap((row) => row.id ? [row.id] : []);
  if (ids.length) {
    const completed = await db.rpc("complete_chat_attachment_cleanup", { p_attachment_ids: ids });
    if (completed.error) throw new Error("Chat attachment cleanup completion failed.");
  }
  return { removed: rows.length };
}
