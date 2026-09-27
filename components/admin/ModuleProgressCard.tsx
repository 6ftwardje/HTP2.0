import {
  adminMarkStudentModuleComplete,
  adminResetStudentModuleProgress,
} from "@/app/actions/admin/progress";
import type { AdminModuleProgressBlock } from "@/lib/admin/types";
import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { stripModulePrefix } from "@/lib/module-title";

export function ModuleProgressCard({
  block,
  studentId,
}: {
  block: AdminModuleProgressBlock;
  studentId: string;
}) {
  const { module, lessons, completedCount, totalLessons, examSummary } = block;
  const moduleTitle = stripModulePrefix(module.title, module.order_index);
  const pct =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <section
      className="cb-panel overflow-hidden"
      aria-labelledby={`module-${module.id}-title`}
    >
      <div className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_94%,var(--background)_6%)] px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id={`module-${module.id}-title`} className="cb-h2">
              {moduleTitle}
            </h3>
            <p className="cb-caption mt-1">
              {completedCount} van {totalLessons} lessen afgerond ({pct}%)
            </p>
          </div>
          {examSummary && (
            <div className="text-right text-sm">
              <div className="font-bold text-[var(--foreground)]">
                Toets: {examSummary.exam.title}
              </div>
              <div className="cb-caption mt-1">
                {examSummary.hasPassed ? (
                  <span className="cb-badge cb-badge-completed">Geslaagd</span>
                ) : examSummary.latestResult ? (
                  <span className="cb-badge cb-badge-available">Niet geslaagd</span>
                ) : (
                  <span className="cb-badge cb-badge-locked">Nog niet gemaakt</span>
                )}
                {examSummary.latestResult && (
                  <span className="ml-2 text-[var(--muted)]">
                    Laatste score {examSummary.latestResult.score}% ·{" "}
                    {examSummary.attemptCount} {examSummary.attemptCount === 1 ? "poging" : "pogingen"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ul className="divide-y divide-[var(--border)] px-5 py-2" role="list">
        {lessons.map(({ lesson, watched, watchedAt }) => (
          <li
            key={lesson.id}
            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium text-[var(--foreground)]">{lesson.title}</span>
            <span className="flex flex-wrap items-center gap-2">
              {watched ? (
                <>
                  <span className="cb-badge cb-badge-completed">Afgerond</span>
                  {watchedAt && (
                    <span className="text-xs text-[var(--muted)]">
                      {new Intl.DateTimeFormat("nl-BE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(watchedAt))}
                    </span>
                  )}
                </>
              ) : (
                <span className="cb-badge cb-badge-locked">Nog niet afgerond</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_40%,var(--card)_60%)] px-5 py-4 sm:flex-row sm:flex-wrap">
        <ConfirmForm
          action={
            adminMarkStudentModuleComplete.bind(
              null,
              studentId,
              module.id
            ) as unknown as (formData: FormData) => Promise<void>
          }
          confirmMessage={`Alle lessen van “${moduleTitle}” als afgerond markeren voor deze student?`}
        >
          <button type="submit" className="cb-btn cb-btn-primary text-sm">
            Markeer module als afgerond
          </button>
        </ConfirmForm>
        <ConfirmForm
          action={adminResetStudentModuleProgress.bind(null, studentId, module.id)}
          confirmMessage={`De lesvoortgang van “${moduleTitle}” wissen? Toetsresultaten blijven bewaard.`}
        >
          <button type="submit" className="cb-btn cb-btn-secondary text-sm">
            Wis lesvoortgang
          </button>
        </ConfirmForm>
      </div>
    </section>
  );
}
