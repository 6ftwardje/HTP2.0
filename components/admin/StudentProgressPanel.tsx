import type { AdminModuleProgressBlock } from "@/lib/admin/types";
import { ModuleProgressCard } from "@/components/admin/ModuleProgressCard";

export function StudentProgressPanel({
  modules,
  studentId,
}: {
  modules: AdminModuleProgressBlock[];
  studentId: string;
}) {
  if (modules.length === 0) {
    return (
      <div className="cb-panel p-8 text-center">
        <p className="cb-body">No published modules found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {modules.map((block) => (
        <ModuleProgressCard key={block.module.id} block={block} studentId={studentId} />
      ))}
    </div>
  );
}
