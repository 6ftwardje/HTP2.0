import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { getLessonBySlug, getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getModuleById } from "@/lib/modules";
import { getLessonStatuses } from "@/lib/lesson-gate";
import { getProgressByLessonIds } from "@/lib/progress";
import { getExamByModuleId } from "@/lib/exams";
import { VimeoPlayer } from "@/components/VimeoPlayer";
import { LessonAutoCompleteVideo } from "./LessonAutoCompleteVideo";
import { asText } from "@/lib/as-text";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { RightRailCard } from "@/components/layout/RightRailCard";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { LessonActionList } from "@/components/LessonActionList";
import { stripModulePrefix } from "@/lib/module-title";
import {
  getLessonActionProgress,
  normalizeLessonActions,
} from "@/lib/lesson-actions";
import type { LessonStatus } from "@/lib/types";
import {
  getStudentOnboardingResponse,
  onboardingIsComplete,
} from "@/lib/onboarding";

type Props = { params: Promise<{ slug: string }> };

function LessonRailRow({
  lessonSlug,
  title,
  orderIndex,
  status,
  isCurrent,
  locked,
  thumbnailUrl,
}: {
  lessonSlug: string;
  title: string;
  orderIndex: number;
  status: LessonStatus;
  isCurrent: boolean;
  locked: boolean;
  thumbnailUrl?: string | null;
}) {
  const label =
    status === "completed"
      ? "Afgerond"
      : status === "available"
        ? "Open"
        : "Vergrendeld";

  if (locked) {
    return (
      <div
        className={`flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 ${
          isCurrent
            ? "bg-[color-mix(in_oklab,var(--card)_88%,var(--muted)_12%)]"
            : "bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] opacity-70"
        }`}
      >
        <CourseThumbnail
          src={thumbnailUrl}
          title={title}
          eyebrow={`${orderIndex}`}
          className="h-12 w-16 shrink-0 rounded-lg"
          muted
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--muted)] line-clamp-2">
            {title}
          </div>
          <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)] opacity-80">
            {label}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/lessons/${lessonSlug}`}
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        isCurrent
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-sm"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[color-mix(in_oklab,var(--foreground)_30%,var(--border)_70%)]"
      }`}
    >
      <CourseThumbnail
        src={thumbnailUrl}
        title={title}
        eyebrow={`${orderIndex}`}
        className="h-12 w-16 shrink-0 rounded-lg"
        muted={isCurrent}
      />
      <div className="min-w-0">
        <div
          className={`text-sm font-semibold leading-snug line-clamp-2 ${
            isCurrent ? "text-[var(--background)]" : "text-[var(--foreground)]"
          }`}
        >
          {title}
        </div>
        <div
          className={`mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${
            isCurrent
              ? "text-[color-mix(in_oklab,var(--background)_72%,transparent)]"
              : "text-[var(--muted)]"
          }`}
        >
          {label}
        </div>
      </div>
    </Link>
  );
}

export default async function LessonPage({ params }: Props) {
  const { slug } = await params;
  const [lesson, { student }] = await Promise.all([
    getLessonBySlug(slug),
    ensureCurrentStudent(),
  ]);
  if (!lesson) notFound();
  if (!student) notFound();

  const allLessons = await getPublishedLessonsByModuleId(lesson.module_id);
  const lessonIds = allLessons.map((l) => l.id);
  const [moduleData, progressMap, exam, onboarding] = await Promise.all([
    getModuleById(lesson.module_id),
    getProgressByLessonIds(student.id, lessonIds),
    getExamByModuleId(lesson.module_id),
    getStudentOnboardingResponse(student.id),
  ]);
  const statusMap = await getLessonStatuses(student.id, allLessons, progressMap);

  if (!moduleData) notFound();
  const moduleTitle = stripModulePrefix(moduleData.title, moduleData.order_index);

  const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
  const status = statusMap.get(lesson.id) ?? "locked";
  const isCompleted = progressMap.get(lesson.id)?.watched === true;
  const canAccess = status === "available" || status === "completed";
  const intakeComplete = onboardingIsComplete(onboarding);

  const prevLesson =
    currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;
  const isLastLesson = nextLesson === null && allLessons.length > 0;
  const allLessonsCompleted = allLessons.every(
    (l) => progressMap.get(l.id)?.watched === true
  );
  const examAvailable = !!exam && allLessonsCompleted;
  const lessonNotes = asText(lesson.description);
  const lessonTakeaway = asText(lesson.takeaway);
  const lessonActions = normalizeLessonActions(lesson.action_items);
  const actionProgress =
    canAccess && lessonActions.length > 0
      ? await getLessonActionProgress(student.id, lesson.id)
      : new Map<number, boolean>();

  if (!canAccess) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: "Academy", href: "/modules" },
            { label: moduleTitle, href: `/modules/${moduleData.slug}` },
            { label: "Les" },
          ]}
          eyebrow="Toegang"
          title="Deze les is nog vergrendeld"
          description="Rond eerst de vorige les in deze module af om verder te gaan."
        />
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center sm:p-10">
          <Link
            href={`/modules/${moduleData.slug}`}
            className="cb-btn cb-btn-primary"
          >
            Terug naar module
          </Link>
        </div>
      </div>
    );
  }

  if (!intakeComplete) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: "Academy", href: "/modules" },
            { label: moduleTitle, href: `/modules/${moduleData.slug}` },
            { label: "Intake" },
          ]}
          eyebrow="Videocourse"
          title="Vul eerst je intake in"
          description="Je kunt rondkijken in de Academy, maar videolessen openen pas nadat je intake is afgerond. Zo krijgt je mentor de context die nodig is om je beter te begeleiden."
        />
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <div className="max-w-2xl">
            <div className="cb-eyebrow text-[var(--accent)]">Waarom dit nodig is</div>
            <p className="mt-4 cb-body">
              We gebruiken je antwoorden om je ervaring, doelen, beschikbare
              tijd en huidige uitdaging te begrijpen. Die context helpt mentors
              en toekomstige AI-coaching om relevanter te reageren op je
              voortgang.
            </p>
            <Link href="/onboarding" className="mt-6 inline-flex cb-btn cb-btn-primary">
              Intake invullen
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const rail = (
    <>
      <RightRailCard title="Module">
        <Link
          href={`/modules/${moduleData.slug}`}
          className="text-sm font-semibold text-[var(--foreground)] underline-offset-2 hover:underline"
        >
          {moduleTitle}
        </Link>
        <p className="mt-2 cb-caption">
          Module {moduleData.order_index} · Les {lesson.order_index} van{" "}
          {allLessons.length}
        </p>
      </RightRailCard>

      <RightRailCard title="Lessen">
        <div className="space-y-2">
          {allLessons.map((l) => {
            const st = statusMap.get(l.id) ?? "locked";
            const locked = st === "locked";
            return (
              <LessonRailRow
                key={l.id}
                lessonSlug={l.slug}
                title={l.title}
                orderIndex={l.order_index}
                status={st}
                isCurrent={l.id === lesson.id}
                locked={locked}
                thumbnailUrl={l.thumbnail_url}
              />
            );
          })}
        </div>
      </RightRailCard>

      <RightRailCard title="Focus">
        <p className="cb-caption leading-relaxed">
          Neem één les tegelijk door. Bekijk de video rustig en werk daarna je
          opdrachten af.
        </p>
      </RightRailCard>
    </>
  );

  const main = (
    <>
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_0_rgba(28,25,23,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="p-4 sm:p-5">
          {isCompleted ? (
            <VimeoPlayer
              videoUrl={lesson.video_url}
              videoProvider={lesson.video_provider}
              muxPlaybackId={lesson.mux_playback_id}
              muxPlaybackPolicy={lesson.mux_playback_policy}
              title={lesson.title}
            />
          ) : (
            <LessonAutoCompleteVideo
              lessonId={lesson.id}
              videoUrl={lesson.video_url}
              videoProvider={lesson.video_provider}
              muxPlaybackId={lesson.mux_playback_id}
              muxPlaybackPolicy={lesson.mux_playback_policy}
              title={lesson.title}
              isCompleted={isCompleted}
            />
          )}
        </div>
      </section>

      {lessonTakeaway && (
        <section className="rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,var(--muted)_12%)] p-5 sm:p-6">
          <div className="cb-eyebrow">Belangrijkste inzicht</div>
          <p className="mt-3 cb-body font-medium text-[var(--foreground)]">
            {lessonTakeaway}
          </p>
        </section>
      )}

      {lessonNotes && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="cb-eyebrow">Over deze les</div>
          <p className="mt-3 cb-body">{lessonNotes}</p>
        </section>
      )}

      {lessonActions.length > 0 && (
        <LessonActionList
          lessonId={lesson.id}
          actions={lessonActions}
          initialCompleted={Object.fromEntries(actionProgress)}
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[42px]">
          {isCompleted ? (
            <span className="cb-badge cb-badge-completed">Afgerond</span>
          ) : (
            <span className="cb-caption">Je voortgang wordt automatisch bijgewerkt.</span>
          )}
        </div>
      </div>

      <nav
        className="flex flex-col gap-4 border-t border-[var(--border)] pt-8 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Navigatie tussen lessen"
      >
        <div>
          {prevLesson ? (
            <Link
              href={`/lessons/${prevLesson.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              ← Vorige: {prevLesson.title}
            </Link>
          ) : (
            <span className="text-sm text-[var(--muted)] opacity-80">Geen vorige les</span>
          )}
        </div>
        <div className="text-right">
          {nextLesson ? (
            <Link
              href={`/lessons/${nextLesson.slug}`}
              className="cb-btn cb-btn-primary inline-flex"
            >
              Volgende: {nextLesson.title}
            </Link>
          ) : isLastLesson && examAvailable ? (
            <Link
              href={`/modules/${moduleData.slug}/exam`}
              className="cb-btn cb-btn-primary inline-flex"
            >
              Start de toets
            </Link>
          ) : isLastLesson ? (
            <p className="text-sm text-[var(--muted)]">
              Rond deze les af om de toets vrij te spelen.
            </p>
          ) : (
            <span className="text-sm text-[var(--muted)] opacity-80">Geen volgende les</span>
          )}
        </div>
      </nav>
    </>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Academy", href: "/modules" },
          { label: moduleTitle, href: `/modules/${moduleData.slug}` },
          { label: lesson.title },
        ]}
        eyebrow={`Module ${moduleData.order_index} · Les ${lesson.order_index}`}
        title={lesson.title}
        meta={
          <span className="cb-caption">
            {lesson.order_index} van {allLessons.length}
          </span>
        }
      />
      <AppPageLayout main={main} rail={rail} />
    </div>
  );
}
