"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, parseAccessLevel } from "@/lib/admin/access";
import { ADMIN_ACCESS_LEVEL } from "@/lib/admin/constants";
import {
  createStudentMentorNoteAdmin,
  updateStudentMentorMetaAdmin,
  updateStudentAccessLevelAdmin,
} from "@/lib/admin/students";
import { logAdminAction } from "@/lib/admin/audit";

export async function adminUpdateStudentAccessLevel(
  targetStudentId: string,
  rawLevel: unknown
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();
  const level = parseAccessLevel(rawLevel);
  if (level === null) {
    return { success: false, error: "Ongeldig toegangsniveau." };
  }

  if (
    targetStudentId === actorStudent.id &&
    level < ADMIN_ACCESS_LEVEL
  ) {
    return {
      success: false,
      error: "Je kunt je eigen adminrechten niet verwijderen.",
    };
  }

  const { error } = await updateStudentAccessLevelAdmin(targetStudentId, level);
  if (error) {
    return { success: false, error };
  }

  await logAdminAction("student.access_level_updated", {
    actorStudentId: actorStudent.id,
    targetStudentId,
    metadata: { access_level: level },
  });

  return { success: true };
}

function parseMentorStatus(value: unknown) {
  if (
    value === "active" ||
    value === "watch" ||
    value === "needs_attention"
  ) {
    return value;
  }
  return null;
}

function parseTags(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function adminUpdateStudentMentorMeta(
  targetStudentId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();
  const mentorStatus = parseMentorStatus(formData.get("mentor_status"));
  if (!mentorStatus) {
    return { success: false, error: "Kies een geldige begeleidingsstatus." };
  }

  const tags = parseTags(formData.get("tags"));
  if (tags.length > 12 || tags.some((tag) => tag.length > 40)) {
    return { success: false, error: "Gebruik maximaal 12 onderwerpen van hoogstens 40 tekens." };
  }

  const { error } = await updateStudentMentorMetaAdmin(
    targetStudentId,
    mentorStatus,
    tags
  );
  if (error) {
    console.error("adminUpdateStudentMentorMeta", error);
    return { success: false, error: "Begeleiding kon niet worden opgeslagen. Probeer opnieuw." };
  }

  await logAdminAction("student.mentor_meta_updated", {
    actorStudentId: actorStudent.id,
    targetStudentId,
    metadata: { mentor_status: mentorStatus, tags },
  });
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${targetStudentId}`);
  return { success: true };
}

export async function adminCreateStudentMentorNote(
  targetStudentId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { actorStudent } = await requireAdmin();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { success: false, error: "Schrijf eerst een notitie." };
  if (body.length > 5000) {
    return { success: false, error: "Een notitie mag maximaal 5.000 tekens bevatten." };
  }
  const isPinned = formData.get("is_pinned") === "on";
  const { error } = await createStudentMentorNoteAdmin(
    targetStudentId,
    actorStudent.id,
    body,
    isPinned
  );
  if (error) {
    console.error("adminCreateStudentMentorNote", error);
    return { success: false, error: "Notitie kon niet worden toegevoegd. Probeer opnieuw." };
  }

  await logAdminAction("student.mentor_note_created", {
    actorStudentId: actorStudent.id,
    targetStudentId,
  });
  revalidatePath(`/admin/students/${targetStudentId}`);
  return { success: true };
}
