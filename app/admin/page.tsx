import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AdminHomePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Manage students, lesson progress, and access. Analytics will expand here in a later phase."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/students"
          className="cb-panel group block p-6 transition-shadow hover:shadow-md"
        >
          <div className="cb-eyebrow">{`Students`}</div>
          <h2 className="cb-h2 mt-4">Students</h2>
          <p className="cb-body mt-2">
            Search and inspect every learner, manage access levels, and open progress detail.
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-bold text-[var(--foreground)] group-hover:underline">
            Open →
          </span>
        </Link>

        <Link
          href="/admin/videos"
          className="cb-panel group block p-6 transition-shadow hover:shadow-md"
        >
          <div className="cb-eyebrow">{`Content`}</div>
          <h2 className="cb-h2 mt-4">Video uploads</h2>
          <p className="cb-body mt-2">
            Upload lesson videos to Mux, sync processing status, and prepare lessons for playback.
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-bold text-[var(--foreground)] group-hover:underline">
            Open →
          </span>
        </Link>

        <Link
          href="/admin/mentor-inbox"
          className="cb-panel group block p-6 transition-shadow hover:shadow-md"
        >
          <div className="cb-eyebrow">{`Mentor`}</div>
          <h2 className="cb-h2 mt-4">Mentor inbox</h2>
          <p className="cb-body mt-2">
            Read and answer student questions, manage triage, and keep mentor context in one place.
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-bold text-[var(--foreground)] group-hover:underline">
            Open →
          </span>
        </Link>

        <Link
          href="/admin/exams"
          className="cb-panel group block p-6 transition-shadow hover:shadow-md"
        >
          <div className="cb-eyebrow">{`Exams`}</div>
          <h2 className="cb-h2 mt-4">Exam management</h2>
          <p className="cb-body mt-2">
            Manage module question banks, answer options, and readiness before students start.
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-bold text-[var(--foreground)] group-hover:underline">
            Open →
          </span>
        </Link>

        <Link
          href="/admin/weekly-updates"
          className="cb-panel group block p-6 transition-shadow hover:shadow-md"
        >
          <div className="cb-eyebrow">{`Premium`}</div>
          <h2 className="cb-h2 mt-4">Weekly updates</h2>
          <p className="cb-body mt-2">
            Upload mentor market analyses, publish weekly videos, and manage subscription-ready content.
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-bold text-[var(--foreground)] group-hover:underline">
            Open →
          </span>
        </Link>

        <div className="cb-panel p-6 opacity-90">
          <div className="cb-eyebrow">{`Progress`}</div>
          <h2 className="cb-h2 mt-4">Progress management</h2>
          <p className="cb-body mt-2">
            Module completion and resets live on each student profile. Use the Students area to drill in.
          </p>
          <Link
            href="/admin/students"
            className="mt-4 inline-flex text-sm font-bold text-[var(--foreground)] underline-offset-4 hover:underline"
          >
            Go to students
          </Link>
        </div>

        <div className="cb-panel border-dashed p-6 sm:col-span-2 lg:col-span-1">
          <div className="cb-eyebrow">{`Coming soon`}</div>
          <h2 className="cb-h2 mt-4">Exam analytics</h2>
          <p className="cb-body mt-2">
            Placeholder for cohort-level reporting, question-level insights, and drop-off analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
