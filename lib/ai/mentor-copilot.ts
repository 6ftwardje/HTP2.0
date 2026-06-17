import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/access";
import { getAdminStudentDetail } from "@/lib/admin/students";
import type { AdminStudentDetail } from "@/lib/admin/types";
import type { AiStudentSummary, MentorSummary } from "@/lib/types";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { loadKnowledge } from "@/lib/ai/knowledge";
import { getFeatureConfig } from "@/lib/ai/registry";
import {
  formatConfidenceScore,
  formatIntakeChoice,
  formatWeeklyTimeCommitment,
} from "@/lib/intake";

const FEATURE = "mentor_summary" as const;
const MAX_TOKENS = 700;

function formatDate(value: string | null): string {
  if (!value) return "onbekend";
  return new Date(value).toISOString().slice(0, 10);
}

/** Zet de bestaande AdminStudentDetail-bundel om naar compacte promptcontext. */
export function buildMentorContext(detail: AdminStudentDetail): string {
  const { student, progressOverview, modules, onboarding, mentorNotes } = detail;
  const lines: string[] = [];

  lines.push("# Student");
  lines.push(`Naam: ${student.name?.trim() || "(geen naam)"}`);
  lines.push(`Access level: ${student.access_level} (1=gratis, 2=betaald, 3=admin)`);
  lines.push(`Mentor-status: ${student.mentor_status}`);
  lines.push(`Tags: ${student.tags.length ? student.tags.join(", ") : "(geen)"}`);
  lines.push(`Aangemaakt: ${formatDate(student.created_at)}`);
  lines.push(`Laatst gezien: ${formatDate(student.last_seen)}`);

  lines.push("");
  lines.push("# Voortgang (overzicht)");
  lines.push(
    `Lessen afgerond: ${progressOverview.completedLessons}/${progressOverview.totalLessonsPublished}`
  );
  lines.push(
    `Module-examens gehaald: ${progressOverview.modulesPassedExams}/${progressOverview.totalModulesWithExam}`
  );

  lines.push("");
  lines.push("# Per module");
  if (modules.length === 0) {
    lines.push("(geen gepubliceerde modules)");
  } else {
    for (const block of modules) {
      const ex = block.examSummary;
      const examPart = ex
        ? ex.attemptCount === 0
          ? "examen nog niet geprobeerd"
          : `examen ${ex.hasPassed ? "gehaald" : "niet gehaald"} (${ex.attemptCount} poging(en)${
              ex.latestResult ? `, laatste score ${ex.latestResult.score}` : ""
            })`
        : "geen examen";
      lines.push(
        `- ${block.module.title}: ${block.completedCount}/${block.totalLessons} lessen, ${examPart}`
      );
    }
  }

  lines.push("");
  lines.push("# Intake");
  if (onboarding) {
    lines.push(
      `Ervaring: ${formatIntakeChoice(onboarding.experience_level, "onbekend")}`
    );
    lines.push(
      `Primaire markt: ${formatIntakeChoice(onboarding.primary_market, "onbekend")}`
    );
    lines.push(
      `Tijd per week: ${formatWeeklyTimeCommitment(onboarding.weekly_time_commitment, "onbekend")}`
    );
    lines.push(
      `Interesse in begeleiding: ${formatIntakeChoice(
        onboarding.mentorship_interest,
        "onbekend"
      )}`
    );
    lines.push(
      `Vertrouwensscore: ${formatConfidenceScore(onboarding.confidence_score, "onbekend")}`
    );
    lines.push(`Hoofduitdaging: ${onboarding.main_challenge?.trim() || "(niet ingevuld)"}`);
    lines.push(`90-dagen-doel: ${onboarding.goal_90_days?.trim() || "(niet ingevuld)"}`);
    lines.push(`Intake afgerond: ${onboarding.completed_at ? "ja" : "nee"}`);
  } else {
    lines.push("(geen intake ingevuld)");
  }

  lines.push("");
  lines.push("# Mentor-notities (menselijke bron van waarheid, niet overschrijven)");
  if (mentorNotes.length === 0) {
    lines.push("(geen notities)");
  } else {
    for (const note of mentorNotes) {
      lines.push(
        `- [${formatDate(note.created_at)}${note.is_pinned ? ", pinned" : ""}] ${note.body.trim()}`
      );
    }
  }

  return lines.join("\n");
}

const SUMMARY_TOOL: Anthropic.Tool = {
  name: "mentor_summary",
  description:
    "Lever de mentor-samenvatting in het vereiste gestructureerde formaat. Roep dit altijd aan.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        description: "Eén korte statuszin over waar de student nu staat. Maximaal één zin.",
      },
      voortgang: {
        type: "string",
        description: "Bondige beschrijving van de voortgang, maximaal twee korte zinnen, met concrete datapunten.",
      },
      risicos: {
        type: "array",
        items: { type: "string" },
        description: "Maximaal 3 risico's of aandachtspunten als observatie. Elk item één korte regel.",
      },
      call_focus: {
        type: "array",
        items: { type: "string" },
        description: "Maximaal 3 concrete onderwerpen voor het volgende gesprek. Elk item één korte regel.",
      },
      open_vragen: {
        type: "array",
        items: { type: "string" },
        description: "Maximaal 3 open vragen voor de student. Elk item één korte regel.",
      },
    },
    required: ["status", "voortgang", "risicos", "call_focus", "open_vragen"],
  },
};

const TASK_INSTRUCTION = `Je krijgt de context van een student. Maak een korte mentor-samenvatting die een mentor in dertig seconden leest ter voorbereiding van een 1-op-1 gesprek. Houd het strak en bondig: liever weinig sterke punten dan veel halve. Baseer je uitsluitend op de aangereikte context; verzin niets. Volg de regels en stijl uit de knowledge hierboven. Geef de output via de tool mentor_summary.`;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function parseSummary(input: unknown): MentorSummary {
  const obj = (input ?? {}) as Record<string, unknown>;
  return {
    status: typeof obj.status === "string" ? obj.status : "",
    voortgang: typeof obj.voortgang === "string" ? obj.voortgang : "",
    risicos: toStringArray(obj.risicos),
    call_focus: toStringArray(obj.call_focus),
    open_vragen: toStringArray(obj.open_vragen),
  };
}

export type GenerateResult = { summary: MentorSummary | null; error: string | null };

/**
 * Genereert een mentor-samenvatting voor een student, cachet hem en logt de call.
 * Admin-only via requireAdmin(). Faalt veilig: bij een fout wordt er gelogd en een
 * foutmelding teruggegeven, nooit een throw richting de UI.
 */
export async function generateMentorStudentSummary(
  studentId: string
): Promise<GenerateResult> {
  const { actorStudent } = await requireAdmin();
  const config = getFeatureConfig(FEATURE);

  const detail = await getAdminStudentDetail(studentId);
  if (!detail) {
    return { summary: null, error: "Student niet gevonden." };
  }

  const db = await createClient();

  try {
    const knowledge = await loadKnowledge(FEATURE);
    const context = buildMentorContext(detail);

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: config.model,
      max_tokens: MAX_TOKENS,
      system: `${knowledge}\n\n# Taak\n${TASK_INSTRUCTION}`,
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "tool", name: SUMMARY_TOOL.name },
      messages: [{ role: "user", content: context }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) {
      throw new Error("Geen gestructureerde output ontvangen van het model.");
    }
    const summary = parseSummary(toolUse.input);

    await db.from("ai_student_summaries").upsert(
      {
        student_id: studentId,
        feature: FEATURE,
        summary,
        model: config.model,
        generated_by: actorStudent.id,
      },
      { onConflict: "student_id,feature" }
    );

    await db.from("ai_interactions").insert({
      student_id: studentId,
      actor_student_id: actorStudent.id,
      feature: FEATURE,
      model: config.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      status: "success",
    });

    return { summary, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    await db.from("ai_interactions").insert({
      student_id: studentId,
      actor_student_id: actorStudent.id,
      feature: FEATURE,
      model: config.model,
      status: "error",
      error: message,
    });
    return { summary: null, error: message };
  }
}

/** Leest de gecachte mentor-samenvatting voor server-render. Admin-only. */
export async function getMentorSummaryAdmin(
  studentId: string
): Promise<AiStudentSummary | null> {
  await requireAdmin();

  const db = await createClient();
  const { data, error } = await db
    .from("ai_student_summaries")
    .select("*")
    .eq("student_id", studentId)
    .eq("feature", FEATURE)
    .maybeSingle();

  if (error || !data) return null;
  return data as AiStudentSummary;
}
