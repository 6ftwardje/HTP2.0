import type { AdminModuleProgressBlock } from "@/lib/admin/types";

export function StudentExamOverview({ modules }: { modules: AdminModuleProgressBlock[] }) {
  const rows = modules.filter((m) => m.examSummary);

  if (rows.length === 0) {
    return (
      <div className="cb-panel p-6">
        <h3 className="cb-section-title">Exam overview</h3>
        <p className="cb-caption mt-2">No exams linked to published modules.</p>
      </div>
    );
  }

  return (
    <div className="cb-panel overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h3 className="cb-section-title">Exam overview</h3>
        <p className="cb-caption mt-1">
          Read-only summary. Attempt counts and latest scores per module exam.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_92%,var(--background)_8%)]">
              <th className="px-5 py-3 font-bold">Module</th>
              <th className="px-5 py-3 font-bold">Exam</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3 font-bold">Latest score</th>
              <th className="px-5 py-3 font-bold">Attempts</th>
              <th className="px-5 py-3 font-bold">Last submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ module, examSummary }) => {
              if (!examSummary) return null;
              const latest = examSummary.latestResult;
              return (
                <tr key={module.id} className="border-b border-[var(--border)]">
                  <td className="px-5 py-3 font-semibold text-[var(--foreground)]">{module.title}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">{examSummary.exam.title}</td>
                  <td className="px-5 py-3">
                    {examSummary.hasPassed ? (
                      <span className="cb-badge cb-badge-completed">Passed</span>
                    ) : latest ? (
                      <span className="cb-badge cb-badge-available">Not passed</span>
                    ) : (
                      <span className="cb-badge cb-badge-locked">No attempts</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted)]">
                    {latest ? `${latest.score}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted)]">{examSummary.attemptCount}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">
                    {latest
                      ? new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(latest.submitted_at))
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
