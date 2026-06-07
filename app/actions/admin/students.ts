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
    return { success: false, error: "Invalid access level" };
  }

  if (
    targetStudentId === actorStudent.id &&
    level < ADMIN_ACCESS_LEVEL
  ) {
    return {
      success: false,
      error: "You cannot remove your own admin access from this account.",
    };
  }

  const { error } = await updateStudentAccessLevelAdmin(targetStudentId, level);
  if (error) {
    return { success: false, error };
  }

  logAdminAction("student.access_level_updated", {
    actorStudentId: actorStudent.id,
    targetStudentId,
    metadata: { access_level: level },
  });

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${targetStudentId}`);
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
) {
  const { actorStudent } = await requireAdmin();
  const mentorStatus = parseMentorStatus(formData.get("mentor_status"));
  if (!mentorStatus) {
    return;
  }

  const { error } = await updateStudentMentorMetaAdmin(
    targetStudentId,
    mentorStatus,
    parseTags(formData.get("tags"))
  );
  if (!error) {
    logAdminAction("student.mentor_meta_updated", {
      actorStudentId: actorStudent.id,
      targetStudentId,
      metadata: { mentor_status: mentorStatus },
    });
    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${targetStudentId}`);
  }
}

export async function adminCreateStudentMentorNote(
  targetStudentId: string,
  formData: FormData
) {
  const { actorStudent } = await requireAdmin();
  const body = String(formData.get("body") ?? "");
  const isPinned = formData.get("is_pinned") === "on";
  const { error } = await createStudentMentorNoteAdmin(
    targetStudentId,
    actorStudent.id,
    body,
    isPinned
  );
  if (!error) {
    logAdminAction("student.mentor_note_created", {
      actorStudentId: actorStudent.id,
      targetStudentId,
    });
    revalidatePath(`/admin/students/${targetStudentId}`);
  }
}
