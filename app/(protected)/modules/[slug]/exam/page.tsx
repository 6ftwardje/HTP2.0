import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { getModuleBySlug } from "@/lib/modules";
import { getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getExamByModuleId, getOrStartExamAttemptForModule } from "@/lib/exams";
import { areAllLessonsCompleted } from "@/lib/progress";
import { getModuleAccessMap } from "@/lib/module-gate";
import { FREE_ACCESS_MODULE_LIMIT, FULL_COURSE_ACCESS_LEVEL } from "@/lib/module-access-policy";
import { getPublishedModules } from "@/lib/modules";
import { getStudentOnboardingResponse, onboardingIsComplete } from "@/lib/onboarding";
import { ExamForm } from "./ExamForm";
import { asText } from "@/lib/as-text";
import { stripModulePrefix } from "@/lib/module-title";
import { PageHeader } from "@/components/layout/PageHeader";

type Props = { params: Promise<{ slug: string }> };

export default async function ModuleExamPage({ params }: Props) {
  const { slug } = await params;
  const [moduleData, { student }] = await Promise.all([
    getModuleBySlug(slug),
    ensureCurrentStudent(),
  ]);
  if (!moduleData) notFound();
  if (!student) notFound();
  const moduleTitle = stripModulePrefix(moduleData.title, moduleData.order_index);

  const [exam, lessons, allModules, onboarding] = await Promise.all([
    getExamByModuleId(moduleData.id),
    getPublishedLessonsByModuleId(moduleData.id),
    getPublishedModules(),
    getStudentOnboardingResponse(student.id),
  ]);

  const lessonIds = lessons.map((l) => l.id);
  const [moduleAccessMap, allLessonsCompleted] = await Promise.all([
    getModuleAccessMap(student.id, allModules),
    areAllLessonsCompleted(student.id, lessonIds),
  ]);
  const canAccessModule = moduleAccessMap.get(moduleData.id) === true;
  const moduleIndex = allModules.findIndex((module) => module.id === moduleData.id);
  const hasLegacyModuleAccess = student.access_level < FULL_COURSE_ACCESS_LEVEL &&
    moduleIndex >= FREE_ACCESS_MODULE_LIMIT && canAccessModule;
  const needsIntake = student.access_level < FULL_COURSE_ACCESS_LEVEL &&
    !onboardingIsComplete(onboarding) && !hasLegacyModuleAccess;
  const examUnlocked = !!exam && allLessonsCompleted && !needsIntake;

  if (!canAccessModule) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: "Academy", href: "/modules" },
            { label: "Toets" },
          ]}
          eyebrow="Toegang"
          title="Module vergrendeld"
          description={student.access_level < FULL_COURSE_ACCESS_LEVEL
            ? "Je gratis toegang omvat de eerste drie modules."
            : "Deze module is nog niet beschikbaar."}
        />
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center sm:p-10">
          <Link href="/modules" className="cb-btn cb-btn-primary">
            Terug naar modules
          </Link>
        </div>
      </div>
    );
  }

  if (needsIntake) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: "Academy", href: "/modules" },
            { label: moduleTitle, href: `/modules/${moduleData.slug}` },
            { label: "Toets" },
          ]}
          eyebrow="Toets"
          title="Vul eerst je intake in"
          description="Na de eerste les vul je je intake in. Daarna kun je de overige lessen afronden en de toets maken."
        />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <Link href="/onboarding" className="cb-btn cb-btn-primary">
            Intake invullen
          </Link>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: "Academy", href: "/modules" },
            { label: moduleTitle, href: `/modules/${moduleData.slug}` },
            { label: "Toets" },
          ]}
          eyebrow="Toets"
          title="Nog geen toets ingesteld"
          description="Voor deze module is nog geen toets beschikbaar."
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

  if (!examUnlocked) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: "Academy", href: "/modules" },
            { label: moduleTitle, href: `/modules/${moduleData.slug}` },
            { label: "Toets" },
          ]}
          eyebrow="Toets"
          title="Toets vergrendeld"
          description={needsIntake
            ? "Vul je intake in om de overige lessen en de toets te openen."
            : "Rond eerst alle lessen in deze module af."}
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

  const attemptResult = await getOrStartExamAttemptForModule(moduleData.id);
  const displayTitle = exam.title.replace(/\bmoduletoets\b/gi, "Toets");
  const description = asText(exam.description);

  const main =
    !attemptResult.success || !attemptResult.attempt ? (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-base font-semibold text-[var(--foreground)]">
          De toets is nog niet klaar om te starten.
        </p>
        <p className="cb-caption mt-3">
          {attemptResult.error ??
            "Deze module heeft nog niet genoeg geldige actieve vragen."}
        </p>
        {typeof attemptResult.activeQuestionCount === "number" && (
          <p className="cb-caption mt-2">
            Actieve vragen: {attemptResult.activeQuestionCount}. Geldige vragen:{" "}
            {attemptResult.validQuestionCount ?? attemptResult.activeQuestionCount}. Vereist: 10.
          </p>
        )}
        <Link
          href={`/modules/${moduleData.slug}`}
          className="mt-6 inline-flex text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Terug naar module
        </Link>
      </div>
    ) : (
      <ExamForm
        attempt={attemptResult.attempt}
        passingScore={exam.passing_score}
        moduleSlug={moduleData.slug}
        moduleTitle={moduleTitle}
      />
    );

  return (
    <section className="grid min-h-0 gap-8 lg:min-h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1fr)] xl:gap-12">
      <aside className="flex min-h-0 flex-col justify-center">
        <div className="cb-eyebrow">
          Academy / Module {moduleData.order_index} / Toets
        </div>
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.02] text-[var(--foreground)] sm:text-5xl xl:text-[3.4rem]">
          {displayTitle}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {description}
          </p>
        )}
        <div className="mt-8 grid max-w-xl gap-4 border-t border-[var(--border)] pt-6 sm:grid-cols-2">
          <div>
            <p className="cb-caption">Module</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {moduleTitle}
            </p>
          </div>
          <div>
            <p className="cb-caption">Norm</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              Slagen vanaf {exam.passing_score}%
            </p>
          </div>
        </div>
        <Link
          href={`/modules/${moduleData.slug}`}
          className="mt-8 inline-flex w-fit text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Terug naar module
        </Link>
      </aside>

      <div className="min-h-0">{main}</div>
    </section>
  );
}
