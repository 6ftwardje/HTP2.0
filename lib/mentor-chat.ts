import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/access";
import { getCurrentStudent } from "@/lib/students";
import { measureAsync } from "@/lib/performance";
import type {
  ConversationMessage,
  ConversationThread,
  ConversationThreadPriority,
  ConversationThreadStatus,
  Student,
} from "@/lib/types";

const THREAD_COLUMNS =
  "id, student_id, assigned_to_student_id, status, priority, category, source_type, source_id, subject, last_message_at, last_student_message_at, last_mentor_message_at, unread_for_student_count, unread_for_mentor_count, first_response_at, closed_at, metadata, created_at, updated_at";

const MESSAGE_COLUMNS =
  "id, thread_id, sender_student_id, sender_role, body, body_format, client_message_id, status, is_internal, parent_message_id, metadata, created_at, edited_at, deleted_at";

const STUDENT_COLUMNS =
  "id, email, name, auth_user_id, access_level, mentor_status, tags, onboarding_skipped_at, created_at, updated_at, last_seen, phone";

export type StudentMentorConversation = {
  thread: ConversationThread;
  messages: ConversationMessage[];
};

export type AdminMentorThreadRow = ConversationThread & {
  student: Pick<
    Student,
    "id" | "email" | "name" | "mentor_status" | "tags" | "access_level" | "last_seen"
  > | null;
  lastMessage: ConversationMessage | null;
};

export type AdminMentorThreadDetail = {
  thread: AdminMentorThreadRow;
  messages: ConversationMessage[];
};

function normalizeBody(body: string) {
  return body.replace(/\r\n/g, "\n").trim();
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("does not exist");
}

async function getDefaultThread(
  studentId: string
): Promise<ConversationThread | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("conversation_threads")
    .select(THREAD_COLUMNS)
    .eq("student_id", studentId)
    .eq("source_type", "mentor_chat")
    .is("source_id", null)
    .maybeSingle();

  if (isMissingTable(error)) return null;
  if (error) throw new Error(error.message);
  return (data as ConversationThread | null) ?? null;
}

async function createDefaultThread(
  studentId: string
): Promise<ConversationThread | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("conversation_threads")
    .insert({
      student_id: studentId,
      source_type: "mentor_chat",
      subject: "Chat met Rousso",
    })
    .select(THREAD_COLUMNS)
    .single();

  if (!error) return data as ConversationThread;

  if (error.code === "23505") {
    return await getDefaultThread(studentId);
  }
  if (isMissingTable(error)) return null;
  throw new Error(error.message);
}

export async function getOrCreateStudentMentorConversation(): Promise<{
  conversation: StudentMentorConversation | null;
  missingMigration: boolean;
  error: string | null;
}> {
  const { student, error: studentError } = await getCurrentStudent();
  if (studentError || !student) {
    return { conversation: null, missingMigration: false, error: "Niet ingelogd." };
  }

  try {
    const thread =
      (await getDefaultThread(student.id)) ?? (await createDefaultThread(student.id));
    if (!thread) {
      return { conversation: null, missingMigration: true, error: null };
    }

    const db = await createClient();
    const { data, error } = await measureAsync(
      "mentor.chat.student.messages.query",
      async () =>
        await db
          .from("conversation_messages")
          .select(MESSAGE_COLUMNS)
          .eq("thread_id", thread.id)
          .eq("is_internal", false)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(100)
    );

    if (error) {
      if (isMissingTable(error)) {
        return { conversation: null, missingMigration: true, error: null };
      }
      return { conversation: null, missingMigration: false, error: error.message };
    }

    return {
      conversation: {
        thread,
        messages: (data ?? []) as ConversationMessage[],
      },
      missingMigration: false,
      error: null,
    };
  } catch (err) {
    return {
      conversation: null,
      missingMigration: false,
      error: err instanceof Error ? err.message : "Chat laden mislukt.",
    };
  }
}

export async function createStudentMentorMessage(
  body: string,
  clientMessageId?: string
): Promise<{ threadId: string | null; error: string | null }> {
  const { student, error: studentError } = await getCurrentStudent();
  if (studentError || !student) return { threadId: null, error: "Niet ingelogd." };

  const trimmed = normalizeBody(body);
  if (!trimmed) return { threadId: null, error: "Bericht is leeg." };
  if (trimmed.length > 5000) {
    return { threadId: null, error: "Bericht is te lang. Gebruik maximaal 5000 tekens." };
  }

  const thread =
    (await getDefaultThread(student.id)) ?? (await createDefaultThread(student.id));
  if (!thread) return { threadId: null, error: "Chat-tabellen bestaan nog niet in Supabase." };

  const db = await createClient();
  const { error } = await db.from("conversation_messages").insert({
    thread_id: thread.id,
    sender_student_id: student.id,
    sender_role: "student",
    body: trimmed,
    body_format: "plain",
    client_message_id: clientMessageId || crypto.randomUUID(),
  });

  if (error) {
    if (error.code === "23505") return { threadId: thread.id, error: null };
    return { threadId: thread.id, error: error.message };
  }
  return { threadId: thread.id, error: null };
}

export async function markStudentMentorThreadRead(threadId: string) {
  const db = await createClient();
  await db.rpc("mark_student_conversation_read", { p_thread_id: threadId });
}

export async function markAdminMentorThreadRead(threadId: string) {
  await requireAdmin();
  const db = await createClient();
  await db.rpc("mark_mentor_conversation_read", { p_thread_id: threadId });
}

export async function listAdminMentorThreads(params: {
  status?: string;
  q?: string;
  selectedThreadId?: string;
  limit?: number;
}): Promise<{
  rows: AdminMentorThreadRow[];
  selectedThreadId: string | null;
  missingMigration: boolean;
}> {
  await requireAdmin();
  const db = await createClient();
  const limit = params.limit ?? 40;

  let query = db
    .from("conversation_threads")
    .select(THREAD_COLUMNS)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (
    params.status === "open" ||
    params.status === "pending_mentor" ||
    params.status === "pending_student" ||
    params.status === "snoozed" ||
    params.status === "closed"
  ) {
    query = query.eq("status", params.status);
  } else if (params.status === "unread") {
    query = query.gt("unread_for_mentor_count", 0);
  } else {
    query = query.neq("status", "closed");
  }

  const { data, error } = await measureAsync(
    "admin.mentor_inbox.threads.query",
    async () => await query,
    { status: params.status ?? "active", limit }
  );

  if (error) {
    if (isMissingTable(error)) {
      return { rows: [], selectedThreadId: null, missingMigration: true };
    }
    console.error("listAdminMentorThreads", error.message);
    return { rows: [], selectedThreadId: null, missingMigration: false };
  }

  let threads = ((data ?? []) as ConversationThread[]).filter(
    (thread) => thread.source_type === "mentor_chat"
  );

  const studentIds = [...new Set(threads.map((thread) => thread.student_id))];
  const threadIds = threads.map((thread) => thread.id);

  const [studentsResult, lastMessagesResult] = await Promise.all([
    studentIds.length
      ? db.from("students").select(STUDENT_COLUMNS).in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    threadIds.length
      ? db
          .from("conversation_messages")
          .select(MESSAGE_COLUMNS)
          .in("thread_id", threadIds)
          .eq("is_internal", false)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const students = new Map(
    ((studentsResult.data ?? []) as Student[]).map((student) => [student.id, student])
  );
  const lastMessages = new Map<string, ConversationMessage>();
  for (const message of (lastMessagesResult.data ?? []) as ConversationMessage[]) {
    if (!lastMessages.has(message.thread_id)) {
      lastMessages.set(message.thread_id, message);
    }
  }

  const search = params.q?.trim().toLowerCase();
  let rows = threads.map((thread) => {
    const student = students.get(thread.student_id) ?? null;
    return {
      ...thread,
      student,
      lastMessage: lastMessages.get(thread.id) ?? null,
    };
  });

  if (search) {
    rows = rows.filter((row) => {
      const haystack = [
        row.student?.name,
        row.student?.email,
        row.subject,
        row.lastMessage?.body,
        row.student?.tags.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const selectedThreadId =
    params.selectedThreadId && rows.some((row) => row.id === params.selectedThreadId)
      ? params.selectedThreadId
      : rows[0]?.id ?? null;

  return { rows, selectedThreadId, missingMigration: false };
}

export async function getAdminMentorThreadDetail(
  threadId: string | null
): Promise<AdminMentorThreadDetail | null> {
  await requireAdmin();
  if (!threadId) return null;

  const db = await createClient();
  const { data: threadData, error: threadError } = await db
    .from("conversation_threads")
    .select(THREAD_COLUMNS)
    .eq("id", threadId)
    .maybeSingle();

  if (threadError || !threadData) return null;
  const thread = threadData as ConversationThread;

  const [studentResult, messagesResult] = await Promise.all([
    db.from("students").select(STUDENT_COLUMNS).eq("id", thread.student_id).maybeSingle(),
    db
      .from("conversation_messages")
      .select(MESSAGE_COLUMNS)
      .eq("thread_id", thread.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(150),
  ]);

  return {
    thread: {
      ...thread,
      student: (studentResult.data as Student | null) ?? null,
      lastMessage: null,
    },
    messages: (messagesResult.data ?? []) as ConversationMessage[],
  };
}

export async function createAdminMentorMessage(params: {
  threadId: string;
  actorStudentId: string;
  body: string;
  isInternal?: boolean;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const trimmed = normalizeBody(params.body);
  if (!trimmed) return { error: "Bericht is leeg." };
  if (trimmed.length > 5000) return { error: "Bericht is te lang." };

  const db = await createClient();
  const { error } = await db.from("conversation_messages").insert({
    thread_id: params.threadId,
    sender_student_id: params.actorStudentId,
    sender_role: params.isInternal ? "admin" : "mentor",
    body: trimmed,
    body_format: "plain",
    is_internal: Boolean(params.isInternal),
    client_message_id: crypto.randomUUID(),
  });

  return { error: error?.message ?? null };
}

export async function updateAdminMentorThread(params: {
  threadId: string;
  status?: ConversationThreadStatus;
  priority?: ConversationThreadPriority;
  category?: string | null;
  assignedToStudentId?: string | null;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const update: Record<string, unknown> = {};
  if (params.status) {
    update.status = params.status;
    update.closed_at = params.status === "closed" ? new Date().toISOString() : null;
  }
  if (params.priority) update.priority = params.priority;
  if (params.category !== undefined) update.category = params.category;
  if (params.assignedToStudentId !== undefined) {
    update.assigned_to_student_id = params.assignedToStudentId;
  }
  if (Object.keys(update).length === 0) return { error: null };

  const db = await createClient();
  const { error } = await db
    .from("conversation_threads")
    .update(update)
    .eq("id", params.threadId);
  return { error: error?.message ?? null };
}
