import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/access";
import { getChatAccess } from "@/lib/mentor-chat";
import { getNotificationChrome } from "@/lib/notifications";
import { getOwnAvatar } from "@/lib/market-post-detail";
import { ChatPresenceProvider } from "@/lib/chat-presence";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "test") {
    return <AdminShell studentName={null}>{children}</AdminShell>;
  }

  const { actorStudent } = await requireAdmin();
  const [chatAccess, avatarPath, notificationChrome] = await Promise.all([getChatAccess(), getOwnAvatar(actorStudent.id), getNotificationChrome(actorStudent.id)]);

  return (
    <ChatPresenceProvider currentStudentId={actorStudent.id}><AdminShell {...notificationChrome} studentId={actorStudent.id} avatarPath={avatarPath} studentName={actorStudent.name ?? actorStudent.email} isChatMentor={chatAccess.isMentor}>
      {children}
    </AdminShell></ChatPresenceProvider>
  );
}
