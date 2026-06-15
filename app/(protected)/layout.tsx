import { redirect } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { AppShell } from "@/components/AppShell";
import { getUnreadNotificationCount } from "@/lib/notifications";

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

  const unreadNotificationCount = await getUnreadNotificationCount();

  return (
    <AppShell
      studentName={student.name ?? null}
      accessLevel={student.access_level}
      currentStudentId={student.id}
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </AppShell>
  );
}
