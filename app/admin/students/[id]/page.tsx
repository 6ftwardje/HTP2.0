import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { AccessLevelSelect } from "@/components/admin/AccessLevelSelect";
import { StudentProgressPanel } from "@/components/admin/StudentProgressPanel";
import { StudentExamOverview } from "@/components/admin/StudentExamOverview";
import { AdminDangerZone } from "@/components/admin/AdminDangerZone";
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
  if (status === "needs_attention") return "Aandacht nodig";
  if (status === "watch") return "Opvolgen";
  return "Actief";
}

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ actorStudent }, { id }] = await Promise.all([requireAdmin(), params]);

  const [detail, mentorSummary] = await Promise.all([
    getAdminStudentDetail(id),
    getMentorSummaryAdmin(id),
  ]);
  if (!detail) {
    notFound();
  }

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
          { href: "/admin/students", label: "Studenten" },
          { label },
        ]}
        title={label}
        description={student.email}
        actions={
          <Link href="/admin/students" className="cb-btn cb-btn-secondary text-sm">
            Terug naar studenten
          </Link>
        }
      />

      <AppPageLayout
        main={
          <>
            <section className="cb-panel p-6" aria-labelledby="identity-heading">
              <h2 id="identity-heading" className="cb-section-title">
                Contact en toegang
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">E-mailadres</dt>
                  <dd className="mt-1 font-semibold text-[var(--foreground)]">{student.email}</dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Telefoon</dt>
                  <dd className="mt-1 font-semibold text-[var(--foreground)]">
                    {student.phone?.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Toegangsniveau</dt>
                  <dd className="mt-2">
                    <AccessLevelSelect
                      studentId={student.id}
                      value={student.access_level}
                      actorStudentId={actorStudent.id}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Aangemeld op</dt>
                  <dd className="mt-1 text-[var(--foreground)]">
                    {new Intl.DateTimeFormat("nl-BE", {
                      dateStyle: "long",
                      timeStyle: "short",
                    }).format(new Date(student.created_at))}
                  </dd>
                </div>
                <div>
                  <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Laatst actief</dt>
                  <dd className="mt-1 text-[var(--foreground)]">
                    {student.last_seen
                      ? new Intl.DateTimeFormat("nl-BE", {
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
                    Begeleiding
                  </h2>
                  <p className="cb-body mt-2 max-w-prose">
                    Markeer studenten die opvolging nodig hebben en noteer onderwerpen uit de begeleiding.
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
                    <option value="active">Actief</option>
                    <option value="watch">Opvolgen</option>
                    <option value="needs_attention">Aandacht nodig</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Onderwerpen (tags)
                  </span>
                  <input
                    name="tags"
                    defaultValue={tags.join(", ")}
                    placeholder="Bijv. risicobeheer, mindset"
                    className={fieldClass()}
                  />
                </label>
                <button type="submit" className="cb-btn cb-btn-primary">
                  Begeleiding opslaan
                </button>
              </form>
            </section>

            <section className="cb-panel p-6" aria-labelledby="onboarding-heading">
              <h2 id="onboarding-heading" className="cb-section-title">
                Intake
              </h2>
              {onboarding ? (
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Ervaring</dt>
                    <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                      {formatIntakeChoice(onboarding.experience_level, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Voorkeursmarkt</dt>
                    <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                      {formatIntakeChoice(onboarding.primary_market, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Tijd per week</dt>
                    <dd className="mt-1 font-semibold text-[var(--foreground)]">
                      {formatWeeklyTimeCommitment(onboarding.weekly_time_commitment, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Begeleiding</dt>
                    <dd className="mt-1 font-semibold capitalize text-[var(--foreground)]">
                      {formatIntakeChoice(onboarding.mentorship_interest, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Zelfvertrouwen</dt>
                    <dd className="mt-1 font-semibold text-[var(--foreground)]">
                      {formatConfidenceScore(onboarding.confidence_score, "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Intake afgerond</dt>
                    <dd className="mt-1 font-semibold text-[var(--foreground)]">
                      {onboarding.completed_at ? "Ja" : "Nee"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Grootste uitdaging</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                      {onboarding.main_challenge || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="cb-caption text-xs font-bold uppercase tracking-wider">Doel voor 90 dagen</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                      {onboarding.goal_90_days || "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="cb-caption mt-3">
                  Deze student heeft de intake nog niet afgerond.
                </p>
              )}
            </section>

            <MentorCopilotPanel studentId={student.id} summary={mentorSummary} />

            <section className="cb-panel p-6" aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="cb-section-title">
                Mentornotities
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
                  placeholder="Wat is besproken? Wat is de volgende stap?"
                  className={fieldClass()}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                    <input name="is_pinned" type="checkbox" className="h-4 w-4" />
                    Notitie vastzetten
                  </label>
                  <button type="submit" className="cb-btn cb-btn-primary">
                    Notitie toevoegen
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
                          {new Intl.DateTimeFormat("nl-BE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(note.created_at))}
                        </span>
                        {note.is_pinned && (
                          <span className="cb-badge cb-badge-available">Vastgezet</span>
                        )}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                        {note.body}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="cb-caption">Nog geen mentornotities.</p>
                )}
              </div>
            </section>

            <section className="cb-panel p-6" aria-labelledby="summary-heading">
              <h2 id="summary-heading" className="cb-section-title">
                Voortgang Academy
              </h2>
              <p className="cb-body mt-2 max-w-prose">
                Afgeronde lessen en behaalde module-examens.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,var(--background)_15%)] p-4">
                  <div className="cb-caption text-xs font-bold uppercase">Lessen</div>
                  <div className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">
                    {progressOverview.completedLessons}/{progressOverview.totalLessonsPublished}
                  </div>
                  <div className="cb-caption mt-1">{pct}% afgerond</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,var(--background)_15%)] p-4">
                  <div className="cb-caption text-xs font-bold uppercase">Module-examens behaald</div>
                  <div className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">
                    {progressOverview.modulesPassedExams}/{progressOverview.totalModulesWithExam}
                  </div>
                  <div className="cb-caption mt-1">Minstens één keer geslaagd</div>
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="modules-heading">
              <h2 id="modules-heading" className="cb-section-title">
                Voortgang per module
              </h2>
              <p className="cb-body max-w-prose">
                De acties hieronder veranderen alleen lesvoortgang. Examenresultaten blijven staan.
              </p>
              <StudentProgressPanel modules={modules} studentId={student.id} />
            </section>

            <StudentExamOverview modules={modules} />
          </>
        }
        rail={
          <AdminDangerZone studentId={student.id} studentLabel={label} />
        }
      />
    </div>
  );
}
