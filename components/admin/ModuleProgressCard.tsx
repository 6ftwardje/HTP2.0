import {
  adminMarkStudentModuleComplete,
  adminResetStudentModuleProgress,
} from "@/app/actions/admin/progress";
import type { AdminModuleProgressBlock } from "@/lib/admin/types";
import { ConfirmForm } from "@/components/admin/ConfirmForm";

export function ModuleProgressCard({
  block,
  studentId,
}: {
  block: AdminModuleProgressBlock;
  studentId: string;
}) {
  const { module, lessons, completedCount, totalLessons, examSummary } = block;
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
              {module.title}
            </h3>
            <p className="cb-caption mt-1">
              Lessons {completedCount}/{totalLessons} complete ({pct}%)
            </p>
          </div>
          {examSummary && (
            <div className="text-right text-sm">
              <div className="font-bold text-[var(--foreground)]">
                Exam: {examSummary.exam.title}
              </div>
              <div className="cb-caption mt-1">
                {examSummary.hasPassed ? (
                  <span className="cb-badge cb-badge-completed">Passed</span>
                ) : examSummary.latestResult ? (
                  <span className="cb-badge cb-badge-available">Not passed yet</span>
                ) : (
                  <span className="cb-badge cb-badge-locked">No attempts</span>
                )}
                {examSummary.latestResult && (
                  <span className="ml-2 text-[var(--muted)]">
                    Latest {examSummary.latestResult.score}% ·{" "}
                    {examSummary.attemptCount} attempt
                    {examSummary.attemptCount === 1 ? "" : "s"}
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
                  <span className="cb-badge cb-badge-completed">Watched</span>
                  {watchedAt && (
                    <span className="text-xs text-[var(--muted)]">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(watchedAt))}
                    </span>
                  )}
                </>
              ) : (
                <span className="cb-badge cb-badge-locked">Open</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_40%,var(--card)_60%)] px-5 py-4 sm:flex-row sm:flex-wrap">
        <form
          action={
            adminMarkStudentModuleComplete.bind(
              null,
              studentId,
              module.id
            ) as unknown as (formData: FormData) => Promise<void>
          }
        >
          <button type="submit" className="cb-btn cb-btn-primary text-sm">
            Mark module complete
          </button>
        </form>
        <ConfirmForm
          action={adminResetStudentModuleProgress.bind(null, studentId, module.id)}
          confirmMessage={`Reset lesson progress for “${module.title}”? Exam results are not changed.`}
        >
          <button type="submit" className="cb-btn cb-btn-secondary text-sm">
            Reset module progress
          </button>
        </ConfirmForm>
      </div>
    </section>
  );
}
