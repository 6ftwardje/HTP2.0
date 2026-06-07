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
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { RightRailCard } from "@/components/layout/RightRailCard";

type Props = { params: Promise<{ slug: string }> };

export default async function ModuleExamPage({ params }: Props) {
  const { slug } = await params;
  const moduleData = await getModuleBySlug(slug);
  if (!moduleData) notFound();

  const { student } = await ensureCurrentStudent();
  if (!student) notFound();

  const [exam, lessons, allModules] = await Promise.all([
    getExamByModuleId(moduleData.id),
    getPublishedLessonsByModuleId(moduleData.id),
    getPublishedModules(),
  ]);

  const moduleAccessMap = await getModuleAccessMap(student.id, allModules);
  const canAccessModule = moduleAccessMap.get(moduleData.id) === true;
  const lessonIds = lessons.map((l) => l.id);
  const allLessonsCompleted = await areAllLessonsCompleted(student.id, lessonIds);
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

  const rail = (
    <>
      <RightRailCard title="Afspraken">
        <ul className="space-y-3 cb-caption">
          <li>Beantwoord elke vraag voordat je indient.</li>
          <li>
            Vereiste score:{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {exam.passing_score}%
            </span>
            .
          </li>
          <li>Neem rustig de tijd om elke vraag te lezen.</li>
        </ul>
      </RightRailCard>
      <RightRailCard title="Module">
        <p className="cb-caption leading-relaxed">
          Module:{" "}
          <span className="font-semibold text-[var(--foreground)]">{moduleData.title}</span>
        </p>
        <Link
          href={`/modules/${moduleData.slug}`}
          className="mt-3 inline-flex text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          ← Terug naar module
        </Link>
      </RightRailCard>
    </>
  );

  const main =
    questions.length === 0 ? (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
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
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Academy", href: "/modules" },
          { label: moduleData.title, href: `/modules/${moduleData.slug}` },
          { label: "Toets" },
        ]}
        eyebrow="Moduletoets"
        title={exam.title}
        description={asText(exam.description) ?? undefined}
        meta={
          <span className="cb-caption">Slagen vanaf {exam.passing_score}%</span>
        }
      />
      <AppPageLayout main={main} rail={rail} />
    </div>
  );
}
