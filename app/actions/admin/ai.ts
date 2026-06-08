"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { generateMentorStudentSummary } from "@/lib/ai/mentor-copilot";

/**
 * Genereert (of vernieuwt) de Mentor Copilot-samenvatting voor een student.
 * Doet een echte Anthropic-call. Admin-only via requireAdmin().
 */
export async function adminGenerateMentorSummary(
  targetStudentId: string
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();

  const { summary, error } = await generateMentorStudentSummary(targetStudentId);
  if (error || !summary) {
    return { success: false, error: error ?? "Genereren mislukt." };
  }

  logAdminAction("student.ai_mentor_summary_generated", {
    actorStudentId: actorStudent.id,
    targetStudentId,
  });

  revalidatePath(`/admin/students/${targetStudentId}`);
  return { success: true };
}
