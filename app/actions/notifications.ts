"use server";

import { revalidatePath } from "next/cache";
import { archiveNotification, markAllNotificationsRead, markNotificationRead, markSourceNotificationsRead } from "@/lib/notifications";
import type { NotificationSource } from "@/lib/notification-policy";

function refreshChrome() { revalidatePath("/", "layout"); }

export async function readNotification(id: string) {
  const result = await markNotificationRead(id);
  if (result.success) refreshChrome();
  return result;
}
export async function readAllNotifications() {
  const result = await markAllNotificationsRead();
  if (result.success) refreshChrome();
  return result;
}
export async function removeNotification(id: string) {
  const result = await archiveNotification(id);
  if (result.success) refreshChrome();
  return result;
}
export async function readSourceNotifications(targets: NotificationSource[]) {
  const result = await markSourceNotificationsRead(targets);
  if (result.success && result.changed) refreshChrome();
  return result;
}
