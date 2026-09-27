import type { AdminModuleProgressBlock } from "@/lib/admin/types";
import { stripModulePrefix } from "@/lib/module-title";

export function StudentExamOverview({ modules }: { modules: AdminModuleProgressBlock[] }) {
  const rows = modules.filter((m) => m.examSummary);

  if (rows.length === 0) {
    return (
      <div className="cb-panel p-6">
        <h3 className="cb-section-title">Toetsresultaten</h3>
        <p className="cb-caption mt-2">Er zijn nog geen toetsen gekoppeld aan gepubliceerde modules.</p>
      </div>
    );
  }

  return (
    <div className="cb-panel overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h3 className="cb-section-title">Toetsresultaten</h3>
        <p className="cb-caption mt-1">
          Laatste score en aantal pogingen per moduletoets.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_92%,var(--background)_8%)]">
              <th className="px-5 py-3 font-bold">Module</th>
              <th className="px-5 py-3 font-bold">Toets</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3 font-bold">Laatste score</th>
              <th className="px-5 py-3 font-bold">Pogingen</th>
              <th className="px-5 py-3 font-bold">Laatst ingediend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ module, examSummary }) => {
              if (!examSummary) return null;
              const latest = examSummary.latestResult;
              const moduleTitle = stripModulePrefix(
                module.title,
                module.order_index
              );
              return (
                <tr key={module.id} className="border-b border-[var(--border)]">
                  <td className="px-5 py-3 font-semibold text-[var(--foreground)]">{moduleTitle}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">{examSummary.exam.title}</td>
                  <td className="px-5 py-3">
                    {examSummary.hasPassed ? (
                      <span className="cb-badge cb-badge-completed">Geslaagd</span>
                    ) : latest ? (
                      <span className="cb-badge cb-badge-available">Niet geslaagd</span>
                    ) : (
                      <span className="cb-badge cb-badge-locked">Nog niet gemaakt</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted)]">
                    {latest ? `${latest.score}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted)]">{examSummary.attemptCount}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">
                    {latest
                      ? new Intl.DateTimeFormat("nl-BE", {
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
