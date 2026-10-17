"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import {
  createAdminMentorMessage,
  getChatMessagePage,
  getChatProfiles,
  markAdminMentorThreadRead,
  requireChatMentor,
  updateAdminMentorThread,
  type ChatSendResult,
} from "@/lib/mentor-chat";
import type {
  ConversationThreadPriority,
  ConversationThreadStatus,
} from "@/lib/types";

function parseStatus(value: unknown): ConversationThreadStatus | null {
  if (
    value === "open" ||
    value === "pending_mentor" ||
    value === "pending_student" ||
    value === "snoozed" ||
    value === "closed"
  ) {
    return value;
  }
  return null;
}

function parsePriority(value: unknown): ConversationThreadPriority | null {
  if (value === "normal" || value === "high" || value === "urgent") {
    return value;
  }
  return null;
}

export async function adminReplyToMentorThread(
  threadId: string,
  formData: FormData
): Promise<ChatSendResult> {
  const { actorStudent } = await requireChatMentor();
  const body = String(formData.get("body") ?? "");
  const isInternal = formData.get("is_internal") === "on";
  const result = await createAdminMentorMessage({
    threadId,
    clientMessageId: String(formData.get("client_message_id") ?? ""),
    body,
    isInternal,
    attachmentIds: formData.getAll("attachment_ids").map(String),
    uploadIntent: String(formData.get("upload_intent") ?? ""),
  });

  if (!result.success) return result;

  await logAdminAction(isInternal ? "mentor_chat.internal_note_created" : "mentor_chat.replied", {
    actorStudentId: actorStudent.id,
    metadata: { threadId },
  });
  revalidatePath("/mentor-inbox");
  revalidatePath("/mentor");
  revalidatePath("/notifications");
  return result;
}

export async function adminUpdateMentorThread(
  threadId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireChatMentor();
  const status = parseStatus(formData.get("status"));
  const priority = parsePriority(formData.get("priority"));
  const categoryRaw = String(formData.get("category") ?? "").trim();

  const { error } = await updateAdminMentorThread({
    threadId,
    status: status ?? undefined,
    priority: priority ?? undefined,
    category: categoryRaw || null,
  });

  if (error) return { success: false, error };

  await logAdminAction("mentor_chat.thread_updated", {
    actorStudentId: actorStudent.id,
    metadata: { threadId, status, priority, category: categoryRaw || null },
  });
  revalidatePath("/mentor-inbox");
  return { success: true };
}

export async function adminMarkMentorThreadRead(threadId: string, seenSeq: number) {
  return markAdminMentorThreadRead(threadId, seenSeq);
}

export async function loadAdminMentorMessages(threadId: string, beforeSeq: number) {
  await requireChatMentor();
  try {
    const page = await getChatMessagePage(threadId, beforeSeq);
    const profiles = await getChatProfiles(page.messages.flatMap((message) => message.sender_student_id ? [message.sender_student_id] : []));
    return { success: true as const, ...page, profiles };
  } catch {
    return { success: false as const, error: "Eerdere berichten laden is niet gelukt. Probeer opnieuw." };
  }
}
