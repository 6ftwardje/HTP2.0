import { redirect } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { AppShell } from "@/components/AppShell";
import { ADMIN_ACCESS_LEVEL } from "@/lib/admin/constants";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "test") {
    // Test-mode: geen auth/redirects nodig; render gewoon de protected UI.
    return (
      <AppShell studentName={null} showAdminNav={false}>
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

  return (
    <AppShell
      studentName={student.name ?? null}
      showAdminNav={student.access_level === ADMIN_ACCESS_LEVEL}
    >
      {children}
    </AppShell>
  );
}
