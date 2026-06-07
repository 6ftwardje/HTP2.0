import { createClient } from "@/lib/supabase/server";
import type { DashboardNextStep } from "@/lib/dashboard";
import type { StudentNextStep } from "@/lib/types";

type StepInput = {
  student_id: string;
  step_key: string;
  step_type: StudentNextStep["step_type"];
  status: StudentNextStep["status"];
  title: string;
  description: string | null;
  href: string | null;
  cta_label: string | null;
  source_table: string | null;
  source_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  completed_at: string | null;
};

const SYSTEM_STEP_TYPES: StudentNextStep["step_type"][] = [
  "intake",
  "lesson",
  "lesson_action",
  "exam",
  "module",
];

const STUDENT_NEXT_STEP_COLUMNS =
  "id, student_id, step_key, step_type, status, title, description, href, cta_label, source_table, source_id, sort_order, metadata, due_at, completed_at, created_at, updated_at";

function activeStepMatches(
  current: StudentNextStep | null,
  next: StepInput
): current is StudentNextStep {
  if (!current) return false;
  return (
    current.step_key === next.step_key &&
    current.step_type === next.step_type &&
    current.status === next.status &&
    current.title === next.title &&
    current.description === next.description &&
    current.href === next.href &&
    current.cta_label === next.cta_label &&
    current.source_table === next.source_table &&
    current.source_id === next.source_id &&
    current.sort_order === next.sort_order &&
    JSON.stringify(current.metadata ?? {}) === JSON.stringify(next.metadata ?? {})
  );
}

function stepFromDashboardNextStep(
  studentId: string,
  nextStep: DashboardNextStep
): StepInput {
  if (nextStep.type === "lesson") {
    const nextActionIndex = nextStep.actions.findIndex(
      (_, index) => !nextStep.actionProgress.get(index)
    );

    if (nextActionIndex >= 0) {
      const action = nextStep.actions[nextActionIndex];
      return {
        student_id: studentId,
        step_key: `lesson_action:${nextStep.lesson.id}:${nextActionIndex}`,
        step_type: "lesson_action",
        status: "active",
        title: "Werk je eerstvolgende opdracht af",
        description: action,
        href: nextStep.href,
        cta_label: "Naar de opdracht",
        source_table: "lessons",
        source_id: String(nextStep.lesson.id),
        sort_order: 20,
        metadata: {
          module_id: nextStep.module.id,
          module_title: nextStep.module.title,
          lesson_id: nextStep.lesson.id,
          lesson_title: nextStep.lesson.title,
          action_index: nextActionIndex,
          action,
        },
        completed_at: null,
      };
    }

    return {
      student_id: studentId,
      step_key: `lesson:${nextStep.lesson.id}`,
      step_type: "lesson",
      status: "active",
      title: nextStep.lesson.title,
      description: `Ga verder met Module ${nextStep.module.order_index}: ${nextStep.module.title}.`,
      href: nextStep.href,
      cta_label: nextStep.label,
      source_table: "lessons",
      source_id: String(nextStep.lesson.id),
      sort_order: 30,
      metadata: {
        module_id: nextStep.module.id,
        module_title: nextStep.module.title,
        lesson_id: nextStep.lesson.id,
        lesson_title: nextStep.lesson.title,
      },
      completed_at: null,
    };
  }

  if (nextStep.type === "exam") {
    return {
      student_id: studentId,
      step_key: `exam:${nextStep.exam.id}`,
      step_type: "exam",
      status: "active",
      title: nextStep.exam.title,
      description: "Je lessen zijn afgerond. Maak de toets om verder te gaan.",
      href: nextStep.href,
      cta_label: nextStep.label,
      source_table: "exams",
      source_id: String(nextStep.exam.id),
      sort_order: 40,
      metadata: {
        module_id: nextStep.module.id,
        module_title: nextStep.module.title,
        exam_id: nextStep.exam.id,
      },
      completed_at: null,
    };
  }

  if (nextStep.type === "module") {
    return {
      student_id: studentId,
      step_key: `module:${nextStep.module.id}`,
      step_type: "module",
      status: "active",
      title: nextStep.module.title,
      description: "Open de module om verder te gaan met je traject.",
      href: nextStep.href,
      cta_label: nextStep.label,
      source_table: "modules",
      source_id: String(nextStep.module.id),
      sort_order: 50,
      metadata: {
        module_id: nextStep.module.id,
        module_title: nextStep.module.title,
      },
      completed_at: null,
    };
  }

  return {
    student_id: studentId,
    step_key: "academy:completed",
    step_type: "custom",
    status: "active",
    title: "Je traject is afgerond",
    description: "Je hebt alle beschikbare modules doorlopen.",
    href: nextStep.href,
    cta_label: nextStep.label,
    source_table: null,
    source_id: null,
    sort_order: 100,
    metadata: {
      module_id: nextStep.module?.id ?? null,
      module_title: nextStep.module?.title ?? null,
    },
    completed_at: null,
  };
}

function intakeStep(studentId: string): StepInput {
  return {
    student_id: studentId,
    step_key: "intake",
    step_type: "intake",
    status: "active",
    title: "Vul je intake in",
    description:
      "Verplicht voordat je de videocourse opent. Zo krijgen mentors en toekomstige AI-coaching betere context over je huidige staat.",
    href: "/onboarding",
    cta_label: "Intake invullen",
    source_table: "student_onboarding_responses",
    source_id: null,
    sort_order: 10,
    metadata: {},
    completed_at: null,
  };
}

export async function getActiveStudentNextStep(
  studentId: string
): Promise<StudentNextStep | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("student_next_steps")
    .select(STUDENT_NEXT_STEP_COLUMNS)
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as StudentNextStep;
}

export async function syncStudentNextStep(params: {
  studentId: string;
  intakeComplete: boolean;
  dashboardNextStep: DashboardNextStep;
}): Promise<StudentNextStep | null> {
  const db = await createClient();
  const next = params.intakeComplete
    ? stepFromDashboardNextStep(params.studentId, params.dashboardNextStep)
    : intakeStep(params.studentId);

  const { data: currentStep } = await db
    .from("student_next_steps")
    .select(STUDENT_NEXT_STEP_COLUMNS)
    .eq("student_id", params.studentId)
    .eq("status", "active")
    .in("step_type", SYSTEM_STEP_TYPES)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const current = (currentStep as StudentNextStep | null) ?? null;

  if (activeStepMatches(current, next)) {
    return current;
  }

  await db
    .from("student_next_steps")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("student_id", params.studentId)
    .eq("status", "active")
    .in("step_type", SYSTEM_STEP_TYPES)
    .neq("step_key", next.step_key);

  const { data, error } = await db
    .from("student_next_steps")
    .upsert(next, { onConflict: "student_id,step_key" })
    .select(STUDENT_NEXT_STEP_COLUMNS)
    .single();

  if (error || !data) return getActiveStudentNextStep(params.studentId);
  return data as StudentNextStep;
}
