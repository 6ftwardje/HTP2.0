import {
  adminMarkAcademyLessonsComplete,
  adminResetStudentAllProgress,
} from "@/app/actions/admin/progress";
import { ConfirmForm } from "@/components/admin/ConfirmForm";

export function AdminDangerZone({ studentId, studentLabel }: { studentId: string; studentLabel: string }) {
  return (
    <section
      className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6 dark:bg-red-950/30"
      aria-labelledby="danger-zone-title"
    >
      <h3 id="danger-zone-title" className="cb-h2 text-red-900 dark:text-red-100">
        Danger zone
      </h3>
      <p className="cb-caption mt-2 max-w-prose">
        Lesson progress only. Exam results are never changed from these actions. Scope is explicit for
        each button.
      </p>
      <div className="mt-5 flex flex-col gap-3">
        <ConfirmForm
          action={adminMarkAcademyLessonsComplete.bind(null, studentId)}
          confirmMessage={`Mark ALL published lessons as watched for ${studentLabel}? This does not pass exams or create exam results.`}
        >
          <button type="submit" className="cb-btn border border-amber-600/40 bg-amber-500/15 text-sm font-bold text-amber-950 dark:text-amber-50">
            Mark all lessons complete (academy-wide)
          </button>
        </ConfirmForm>
        <ConfirmForm
          action={adminResetStudentAllProgress.bind(null, studentId)}
          confirmMessage={`DELETE all lesson progress rows for ${studentLabel}? Exam results stay unchanged. This cannot be undone from here.`}
        >
          <button type="submit" className="cb-btn border border-red-600/50 bg-red-600/15 text-sm font-bold text-red-900 dark:text-red-100">
            Reset all lesson progress (academy-wide)
          </button>
        </ConfirmForm>
      </div>
    </section>
  );
}
