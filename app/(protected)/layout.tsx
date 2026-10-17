import { redirect } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { AppShell } from "@/components/AppShell";
import {
  getNotificationShellReadModel,
  getUnreadNotificationCount,
  listMyNotifications,
} from "@/lib/notifications";
import { ADMIN_ACCESS_LEVEL } from "@/lib/admin/constants";
import { getChatAccess } from "@/lib/mentor-chat";
import { ChatPresenceProvider } from "@/lib/chat-presence";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "test") {
    // Test-mode: geen auth/redirects nodig; render gewoon de protected UI.
    return (
      <AppShell studentName={null} accessLevel={null}>
        {children}
      </AppShell>
    );
  }

  const { student, error } = await ensureCurrentStudent();

  if (error) {
    redirect("/?redirectedFrom=" + encodeURIComponent("/dashboard"));
  }

  if (!student) {
    redirect("/?redirectedFrom=" + encodeURIComponent("/dashboard"));
  }

  const chatAccess = await getChatAccess();

  const notificationShell =
    chatAccess.available || (
      process.env.PROJECT_SPEED_NOTIFICATION_SHELL === "1" &&
      student.access_level === ADMIN_ACCESS_LEVEL
    )
      ? await getNotificationShellReadModel(student.id)
      : null;
  const [unreadNotificationCount, notificationResult] = notificationShell
    ? [
        notificationShell.unreadCount,
        { notifications: notificationShell.notifications },
      ]
    : await Promise.all([
        getUnreadNotificationCount(),
        listMyNotifications(),
      ]);

  const floatingNotifications = notificationResult.notifications
    .slice(0, 8)
    .map((notification) => ({
      id: notification.id,
      title: notification.event?.title ?? "Melding",
      description: notification.event?.body ?? "",
      timestamp: notification.created_at,
      read: Boolean(notification.read_at),
      href: notification.event?.href ?? null,
    }));

  return (
    <ChatPresenceProvider currentStudentId={student.id}><AppShell
      studentName={student.name ?? null}
      accessLevel={student.access_level}
      currentStudentId={student.id}
      isChatMentor={chatAccess.isMentor}
      unreadChatCount={chatAccess.unreadCount}
      unreadNotificationCount={unreadNotificationCount}
      floatingNotifications={floatingNotifications}
    >
      {children}
    </AppShell></ChatPresenceProvider>
  );
}
