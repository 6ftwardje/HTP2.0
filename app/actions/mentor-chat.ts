"use server";

import { revalidatePath } from "next/cache";
import {
  createStudentMentorMessage,
  markStudentMentorThreadRead,
} from "@/lib/mentor-chat";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

type ActionResult = { success: true } | { success: false; error: string };

export async function sendMentorMessage(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const body = String(formData.get("body") ?? "");
  const clientMessageId = String(formData.get("client_message_id") ?? "");
  const { error } = await createStudentMentorMessage(body, clientMessageId);
  if (error) return { success: false, error };

  revalidatePath("/mentor");
  revalidatePath("/dashboard");
  revalidatePath("/admin/mentor-inbox");
  return { success: true };
}

export async function markMentorThreadRead(threadId: string) {
  await markStudentMentorThreadRead(threadId);
  revalidatePath("/mentor");
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
