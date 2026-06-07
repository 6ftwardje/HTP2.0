import { createClient } from "@/lib/supabase/server";
import type {
  Student,
  StudentMentorNote,
  StudentOnboardingResponse,
} from "@/lib/types";
import type { AdminSortField, AdminStudentListRow } from "@/lib/admin/types";
import { buildAdminStudentProgressDetail } from "@/lib/admin/progress";
import type { AdminStudentDetail } from "@/lib/admin/types";
import { requireAdmin } from "@/lib/admin/access";

type ListParams = {
  q?: string;
  sortBy: AdminSortField;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
};

export async function listStudentsAdmin(
  params: ListParams
): Promise<{ rows: AdminStudentListRow[]; total: number }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { rows: [], total: 0 };
  }

  const db = await createClient();
  const { q, sortBy, order, page, pageSize } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let qBuilder = db
    .from("students")
    .select(
      "id, email, name, phone, access_level, mentor_status, tags, created_at, last_seen",
      { count: "exact" }
    );

  const trimmed = q?.trim();
  if (trimmed) {
    // PostgREST `or` requires quoted ilike values so `%` / commas in the pattern don’t break the parser.
    const like = `%${trimmed.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const quoted = `"${like.replace(/"/g, '""')}"`;
    qBuilder = qBuilder.or(`name.ilike.${quoted},email.ilike.${quoted}`);
  }

  qBuilder = qBuilder.order(sortBy, {
    ascending: order === "asc",
    nullsFirst: false,
  });

  const { data, error, count } = await qBuilder.range(from, to);

  if (error) {
    console.error(
      "listStudentsAdmin",
      error.message,
      error.code,
      error.details,
      error.hint
    );
    return { rows: [], total: 0 };
  }

  return {
    rows: (data ?? []) as AdminStudentListRow[],
    total: count ?? 0,
  };
}

export async function getStudentByIdAdmin(
  studentId: string
): Promise<Student | null> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const db = await createClient();
  const { data, error } = await db
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Student;
}

export async function getAdminStudentDetail(studentId: string): Promise<AdminStudentDetail | null> {
  const student = await getStudentByIdAdmin(studentId);
  if (!student) return null;

  const [progressDetail, onboarding, mentorNotes] = await Promise.all([
    buildAdminStudentProgressDetail(studentId),
    getStudentOnboardingResponseAdmin(studentId),
    getStudentMentorNotesAdmin(studentId),
  ]);

  return {
    student,
    progressOverview: progressDetail.overview,
    modules: progressDetail.modules,
    onboarding,
    mentorNotes,
  };
}

export async function getStudentOnboardingResponseAdmin(
  studentId: string
): Promise<StudentOnboardingResponse | null> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const db = await createClient();
  const { data, error } = await db
    .from("student_onboarding_responses")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as StudentOnboardingResponse;
}

export async function getStudentMentorNotesAdmin(
  studentId: string
): Promise<StudentMentorNote[]> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const db = await createClient();
  const { data, error } = await db
    .from("student_mentor_notes")
    .select("*")
    .eq("student_id", studentId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as StudentMentorNote[];
}

export async function updateStudentAccessLevelAdmin(
  targetStudentId: string,
  accessLevel: number
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data: exists, error: fetchError } = await db
    .from("students")
    .select("id")
    .eq("id", targetStudentId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!exists) return { error: "Student not found" };

  const { error } = await db
    .from("students")
    .update({ access_level: accessLevel })
    .eq("id", targetStudentId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function updateStudentMentorMetaAdmin(
  targetStudentId: string,
  mentorStatus: Student["mentor_status"],
  tags: string[]
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const cleanTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
    .slice(0, 12);
  const { error } = await db
    .from("students")
    .update({ mentor_status: mentorStatus, tags: cleanTags })
    .eq("id", targetStudentId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function createStudentMentorNoteAdmin(
  targetStudentId: string,
  actorStudentId: string,
  body: string,
  isPinned: boolean
): Promise<{ error: string | null }> {
  await requireAdmin();

  const trimmed = body.trim();
  if (!trimmed) return { error: "Note is empty" };

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db.from("student_mentor_notes").insert({
    student_id: targetStudentId,
    author_student_id: actorStudentId,
    body: trimmed,
    is_pinned: isPinned,
  });

  if (error) return { error: error.message };
  return { error: null };
}
