import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureCurrentStudent } from "@/lib/students";
import { getModuleBySlug } from "@/lib/modules";
import { getPublishedLessonsByModuleId } from "@/lib/lessons";
import { getExamByModuleId, getExamQuestions } from "@/lib/exams";
import { areAllLessonsCompleted } from "@/lib/progress";
import { getModuleAccessMap } from "@/lib/module-gate";
import { getPublishedModules } from "@/lib/modules";
import { ExamForm } from "./ExamForm";
import { asText } from "@/lib/as-text";
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

  const [exam, lessons, allModules] = await Promise.all([
    getExamByModuleId(moduleData.id),
    getPublishedLessonsByModuleId(moduleData.id),
    getPublishedModules(),
  ]);

  const lessonIds = lessons.map((l) => l.id);
  const [moduleAccessMap, allLessonsCompleted] = await Promise.all([
    getModuleAccessMap(student.id, allModules),
    areAllLessonsCompleted(student.id, lessonIds),
  ]);
  const canAccessModule = moduleAccessMap.get(moduleData.id) === true;
  const examUnlocked = !!exam && allLessonsCompleted;

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
          description="Slaag eerst voor de toets van de vorige module."
        />
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center sm:p-10">
          <Link href="/modules" className="cb-btn cb-btn-primary">
            Terug naar modules
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
            { label: moduleData.title, href: `/modules/${moduleData.slug}` },
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
            { label: moduleData.title, href: `/modules/${moduleData.slug}` },
            { label: "Toets" },
          ]}
          eyebrow="Toets"
          title="Toets vergrendeld"
          description="Rond eerst alle lessen in deze module af."
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

  const questions = await getExamQuestions(exam.id);
  const displayTitle = exam.title.replace(/\bmoduletoets\b/gi, "Toets");
  const description = asText(exam.description);

  const main =
    questions.length === 0 ? (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="cb-caption">Deze toets bevat nog geen vragen.</p>
        <Link
          href={`/modules/${moduleData.slug}`}
          className="mt-6 inline-flex text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Terug naar module
        </Link>
      </div>
    ) : (
      <ExamForm
        examId={exam.id}
        questions={questions}
        passingScore={exam.passing_score}
        moduleSlug={moduleData.slug}
        moduleTitle={moduleData.title}
      />
    );

  return (
    <section className="grid h-auto min-h-0 gap-8 overflow-visible lg:h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1fr)] lg:overflow-hidden xl:gap-12">
      <aside className="flex min-h-0 flex-col justify-center overflow-hidden">
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
              {moduleData.title}
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

      <div className="min-h-0 overflow-hidden">{main}</div>
    </section>
  );
}
