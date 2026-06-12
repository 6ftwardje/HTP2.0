import { AdminExamManager } from "@/components/admin/AdminExamManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { listExamManagementAdmin } from "@/lib/admin";

export default async function AdminExamsPage() {
  const data = await listExamManagementAdmin();

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Exam management"
        description="Manage module question banks, answer options, active status, and readiness for student attempts."
      />

      <AdminExamManager data={data} />
    </div>
  );
}
