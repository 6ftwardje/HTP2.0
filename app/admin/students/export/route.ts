import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";
import type { AdminStudentListRow } from "@/lib/admin/types";

const EXPORT_BATCH_SIZE = 1_000;

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);

  // Prevent spreadsheet programs from interpreting student-provided values as formulas.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  await requireAdmin();

  const db = await createClient();
  const students: AdminStudentListRow[] = [];

  for (let from = 0; ; from += EXPORT_BATCH_SIZE) {
    const { data, error } = await db
      .from("students")
      .select(
        "id, email, name, phone, access_level, mentor_status, tags, created_at, last_seen"
      )
      .order("created_at", { ascending: false })
      .range(from, from + EXPORT_BATCH_SIZE - 1);

    if (error) {
      console.error("exportStudentsAdmin", error.message, error.code, error.details);
      return NextResponse.json(
        { error: "Student export could not be generated." },
        { status: 500 }
      );
    }

    const batch = (data ?? []) as AdminStudentListRow[];
    students.push(...batch);
    if (batch.length < EXPORT_BATCH_SIZE) break;
  }

  const header = [
    "ID",
    "Name",
    "Email",
    "Phone",
    "Access level",
    "Mentor status",
    "Tags",
    "Joined",
    "Last seen",
  ];
  const rows = students.map((student) => [
    student.id,
    student.name,
    student.email,
    student.phone,
    student.access_level,
    student.mentor_status,
    (student.tags ?? []).join(", "),
    student.created_at,
    student.last_seen,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const filename = `students-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
