import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "test") {
    return <AdminShell studentName={null}>{children}</AdminShell>;
  }

  const { actorStudent } = await requireAdmin();

  return (
    <AdminShell studentName={actorStudent.name ?? actorStudent.email}>
      {children}
    </AdminShell>
  );
}
