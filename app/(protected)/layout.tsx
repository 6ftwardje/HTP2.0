import { redirect } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { AppShell } from "@/components/AppShell";
import { getNotificationChrome } from "@/lib/notifications";
import { getChatAccess } from "@/lib/mentor-chat";
import { getOwnAvatar } from "@/lib/market-post-detail";
import { canAccessSubscriberContent, getBillingOverview } from "@/lib/billing";
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

  const [chatAccess, avatarPath, notificationChrome, billingOverview] = await Promise.all([
    getChatAccess(), getOwnAvatar(student.id), getNotificationChrome(student.id), getBillingOverview(student.id),
  ]);

  return (
    <ChatPresenceProvider currentStudentId={student.id}><AppShell
      studentName={student.name ?? null}
      avatarPath={avatarPath}
      accessLevel={student.access_level}
      hasSubscriberAccess={canAccessSubscriberContent(student, billingOverview)}
      currentStudentId={student.id}
      isChatMentor={chatAccess.isMentor}
      unreadChatCount={chatAccess.unreadCount}
      {...notificationChrome}
    >
      {children}
    </AppShell></ChatPresenceProvider>
  );
}
