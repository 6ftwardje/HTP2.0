import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { AccessLevelSelect } from "@/components/admin/AccessLevelSelect";
import { StudentProgressPanel } from "@/components/admin/StudentProgressPanel";
import { StudentExamOverview } from "@/components/admin/StudentExamOverview";
import { AdminDangerZone } from "@/components/admin/AdminDangerZone";
import { ExamAnalyticsPlaceholder } from "@/components/admin/ExamAnalyticsPlaceholder";
import { MentorCopilotPanel } from "@/components/admin/MentorCopilotPanel";
import { getAdminStudentDetail } from "@/lib/admin/students";
import { getMentorSummaryAdmin } from "@/lib/ai/mentor-copilot";
import { requireAdmin } from "@/lib/admin/access";
import {
  adminCreateStudentMentorNote,
  adminUpdateStudentMentorMeta,
} from "@/app/actions/admin/students";
import {
  formatConfidenceScore,
  formatIntakeChoice,
  formatWeeklyTimeCommitment,
} from "@/lib/intake";

function fieldClass() {
  return "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border))]";
}

function mentorStatusLabel(status: string) {
  if (status === "needs_attention") return "Needs attention";
  if (status === "watch") return "Watch";
  return "Active";
}

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actorStudent } = await requireAdmin();
  const { id } = await params;

  const detail = await getAdminStudentDetail(id);
  if (!detail) {
    notFound();
  }

  const mentorSummary = await getMentorSummaryAdmin(id);

  const { student, progressOverview, modules, onboarding, mentorNotes } = detail;
  const label = student.name?.trim() || student.email;
  const tags = student.tags ?? [];

  const pct =
    progressOverview.totalLessonsPublished > 0
      ? Math.round(
          (progressOverview.completedLessons / progressOverview.totalLessonsPublished) * 100
        )
      : 0;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/students", label: "Students" },
          { label },
        ]}
        eyebrow="Student profile"
        title={label}
        description={student.email}
        actions={
          <Link href="/admin/students" className="cb-btn cb-btn-secondary text-sm">
            ← All students
          </Link>
        }
      />

      <AppPageLayout
        main={
          <>
            <section className="cb-panel p-6" aria-labelledby="identity-heading">
              <h2 id="identity-heading" className="cb-section-title">
                Identity
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Email</dt>
                  <dd className="mt-1 font-semibold text-[var(--foreground)]">{student.email}</dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Phone</dt>
                  <dd className="mt-1 font-semibold text-[var(--foreground)]">
                    {student.phone?.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Access level</dt>
                  <dd className="mt-2">
                    <AccessLevelSelect
                      studentId={student.id}
                      value={student.access_level}
                      actorStudentId={actorStudent.id}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Joined</dt>
                  <dd className="mt-1 text-[var(--foreground)]">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "long",
                      timeStyle: "short",
                    }).format(new Date(student.created_at))}
                  </dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Last seen</dt>
                  <dd className="mt-1 text-[var(--foreground)]">
                    {student.last_seen
                      ? new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(student.last_seen))
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="cb-panel p-6" aria-labelledby="mentor-heading">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 id="mentor-heading" className="cb-section-title">
                    Mentor triage
                  </h2>
                  <p className="cb-body mt-2 max-w-prose">
                    Keep this lightweight: status for priority, tags for the coaching theme.
                  </p>
                </div>
                <span className="cb-badge cb-badge-available">
                  {mentorStatusLabel(student.mentor_status)}
                </span>
              </div>

              <form
                action={
                  adminUpdateStudentMentorMeta.bind(null, student.id) as unknown as (
                    formData: FormData
                  ) => Promise<void>
                }
                className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end"
              >
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Status
                  </span>
                  <select
                    name="mentor_status"
                    defaultValue={student.mentor_status ?? "active"}
                    className={fieldClass()}
                  >
                    <option value="active">Active</option>
                    <option value="watch">Watch</option>
                    <option value="needs_attention">Needs attention</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Tags
                  </span>
                  <input
                    name="tags"
                    defaultValue={tags.join(", ")}
                    placeholder="risk management, mindset, full access lead"
                    className={fieldClass()}
                  />
                </label>
                <button type="submit" className="cb-btn cb-btn-primary">
                  Save triage
                </button>
              </form>
            </section>

            <section className="cb-panel p-6" aria-labelledby="onboarding-heading">
              <h2 id="onboarding-heading" className="cb-section-title">
                Student context
              </h2>
              {onboarding ? (
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Experience</dt>
                    <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                      {formatIntakeChoice(onboarding.experience_level, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Market</dt>
                    <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                      {formatIntakeChoice(onboarding.primary_market, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Time per week</dt>
                    <dd className="mt-1 font-semibold text-[var(--foreground)]">
                      {formatWeeklyTimeCommitment(onboarding.weekly_time_commitment, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Guidance</dt>
                    <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                      {formatIntakeChoice(onboarding.mentorship_interest, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Confidence</dt>
                    <dd className="mt-1 font-semibold text-[var(--foreground)]">
                      {formatConfidenceScore(onboarding.confidence_score, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Completed</dt>
                    <dd className="mt-1 font-semibold text-[var(--foreground)]">
                      {onboarding.completed_at ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Main challenge</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                      {onboarding.main_challenge || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">90 day goal</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                      {onboarding.goal_90_days || "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="cb-caption mt-3">
                  This student has not completed the intake yet.
                </p>
              )}
            </section>

            <MentorCopilotPanel studentId={student.id} summary={mentorSummary} />

            <section className="cb-panel p-6" aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="cb-section-title">
                Mentor notes
              </h2>
              <form
                action={
                  adminCreateStudentMentorNote.bind(null, student.id) as unknown as (
                    formData: FormData
                  ) => Promise<void>
                }
                className="mt-5 space-y-3"
              >
                <textarea
                  name="body"
                  rows={4}
                  placeholder="Call summary, blockers, next action..."
                  className={fieldClass()}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                    <input name="is_pinned" type="checkbox" className="h-4 w-4" />
                    Pin note
                  </label>
                  <button type="submit" className="cb-btn cb-btn-primary">
                    Add note
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-3">
                {mentorNotes.length > 0 ? (
                  mentorNotes.map((note) => (
                    <article
                      key={note.id}
                      className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_82%,var(--card)_18%)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="cb-caption">
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(note.created_at))}
                        </span>
                        {note.is_pinned && (
                          <span className="cb-badge cb-badge-available">Pinned</span>
                        )}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                        {note.body}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="cb-caption">No mentor notes yet.</p>
                )}
              </div>
            </section>

            <section className="cb-panel p-6" aria-labelledby="summary-heading">
              <h2 id="summary-heading" className="cb-section-title">
                Academy progress
              </h2>
              <p className="cb-body mt-2 max-w-prose">
                Lessons completed across all published modules, and how many module exams have been
                passed at least once.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,var(--background)_15%)] p-4">
                  <div className="cb-caption text-xs font-bold uppercase">Lessons</div>
                  <div className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">
                    {progressOverview.completedLessons}/{progressOverview.totalLessonsPublished}
                  </div>
                  <div className="cb-caption mt-1">{pct}% complete</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,var(--background)_15%)] p-4">
                  <div className="cb-caption text-xs font-bold uppercase">Module exams passed</div>
                  <div className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">
                    {progressOverview.modulesPassedExams}/{progressOverview.totalModulesWithExam}
                  </div>
                  <div className="cb-caption mt-1">At least one passing attempt</div>
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="modules-heading">
              <h2 id="modules-heading" className="cb-section-title">
                Module & lesson progress
              </h2>
              <p className="cb-body max-w-prose">
                Lessons are grouped by module. Actions only affect lesson progress unless stated
                otherwise; exam results stay intact unless you add a dedicated future workflow.
              </p>
              <StudentProgressPanel modules={modules} studentId={student.id} />
            </section>

            <StudentExamOverview modules={modules} />

            <ExamAnalyticsPlaceholder />
          </>
        }
        rail={
          <AdminDangerZone studentId={student.id} studentLabel={label} />
        }
      />
    </div>
  );
}
