import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/access";
import { getChatAccess } from "@/lib/mentor-chat";
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
  const chatAccess = await getChatAccess();

  return (
    <ChatPresenceProvider currentStudentId={actorStudent.id}><AdminShell studentName={actorStudent.name ?? actorStudent.email} isChatMentor={chatAccess.isMentor}>
      {children}
    </AdminShell></ChatPresenceProvider>
  );
}
