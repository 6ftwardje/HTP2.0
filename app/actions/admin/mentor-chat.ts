"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import {
  createAdminMentorMessage,
  markAdminMentorThreadRead,
  updateAdminMentorThread,
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
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();
  const body = String(formData.get("body") ?? "");
  const isInternal = formData.get("is_internal") === "on";
  const { error } = await createAdminMentorMessage({
    threadId,
    actorStudentId: actorStudent.id,
    body,
    isInternal,
  });

  if (error) return { success: false, error };

  await markAdminMentorThreadRead(threadId);
  logAdminAction(isInternal ? "mentor_chat.internal_note_created" : "mentor_chat.replied", {
    actorStudentId: actorStudent.id,
    metadata: { threadId },
  });
  revalidatePath("/admin/mentor-inbox");
  revalidatePath("/mentor");
  revalidatePath("/notifications");
  return { success: true };
}

export async function adminUpdateMentorThread(
  threadId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();
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

  logAdminAction("mentor_chat.thread_updated", {
    actorStudentId: actorStudent.id,
    metadata: { threadId, status, priority, category: categoryRaw || null },
  });
  revalidatePath("/admin/mentor-inbox");
  return { success: true };
}

export async function adminMarkMentorThreadRead(threadId: string) {
  await markAdminMentorThreadRead(threadId);
  revalidatePath("/admin/mentor-inbox");
}
