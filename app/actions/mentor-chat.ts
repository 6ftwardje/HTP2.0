"use server";

import { revalidatePath } from "next/cache";
import {
  createStudentMentorMessage,
  getChatMessagePage,
  markStudentMentorThreadRead,
  type ChatSendResult,
} from "@/lib/mentor-chat";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

type ActionResult = { success: true } | { success: false; error: string };

export async function sendMentorMessage(formData: FormData): Promise<ChatSendResult> {
  const body = String(formData.get("body") ?? "");
  const clientMessageId = String(formData.get("client_message_id") ?? "");
  const result = await createStudentMentorMessage(body, clientMessageId, { attachmentIds: formData.getAll("attachment_ids").map(String), uploadIntent: String(formData.get("upload_intent") ?? "") });
  if (!result.success) return result;

  revalidatePath("/mentor");
  revalidatePath("/dashboard");
  revalidatePath("/mentor-inbox");
  return result;
}

export async function markMentorThreadRead(threadId: string, seenSeq: number) {
  return markStudentMentorThreadRead(threadId, seenSeq);
}

export async function loadMentorMessages(threadId: string, beforeSeq: number) {
  try {
    return { success: true as const, ...await getChatMessagePage(threadId, beforeSeq) };
  } catch {
    return { success: false as const, error: "Eerdere berichten laden is niet gelukt. Probeer opnieuw." };
  }
}

export async function markOneNotificationReadResult(
  notificationId: string
): Promise<ActionResult> {
  const result = await markNotificationRead(notificationId);
  if (!result.success) return result;
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markNotificationsReadResult(): Promise<ActionResult> {
  const result = await markAllNotificationsRead();
  if (!result.success) return result;
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markOneNotificationRead(notificationId: string) {
  await markOneNotificationReadResult(notificationId);
}

export async function markNotificationsRead() {
  await markNotificationsReadResult();
}
