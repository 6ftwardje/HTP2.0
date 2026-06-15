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

export async function markOneNotificationRead(notificationId: string) {
  await markNotificationRead(notificationId);
  revalidatePath("/notifications");
}

export async function markNotificationsRead() {
  await markAllNotificationsRead();
  revalidatePath("/notifications");
}
