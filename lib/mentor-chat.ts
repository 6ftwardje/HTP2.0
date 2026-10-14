import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentStudent } from "@/lib/students";
import { measureAsync } from "@/lib/performance";
import type {
  ConversationMessage,
  ChatAttachment,
  ConversationThread,
  ConversationThreadPriority,
  ConversationThreadStatus,
} from "@/lib/types";

const THREAD_COLUMNS =
  "id, student_id, assigned_to_student_id, status, priority, category, source_type, source_id, subject, last_message_at, last_student_message_at, last_mentor_message_at, unread_for_student_count, unread_for_mentor_count, first_response_at, closed_at, metadata, created_at, updated_at, last_public_message_seq";
const MESSAGE_COLUMNS =
  "id, thread_id, sender_student_id, sender_role, body, body_format, client_message_id, status, is_internal, parent_message_id, metadata, created_at, edited_at, deleted_at, public_seq, sender_principal_id, sender_participant_id";
const PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ChatMentor = { studentId: string; displayName: string };
export type ChatAccess = {
  available: boolean;
  isMentor: boolean;
  unreadCount: number;
  mentor: ChatMentor | null;
  missingMigration: boolean;
  error: string | null;
};
export type StudentMentorConversation = {
  thread: ConversationThread | null;
  messages: ConversationMessage[];
  hasOlder: boolean;
  lastReadSeq: number;
  currentStudentId: string;
};
export type AdminMentorThreadRow = ConversationThread & {
  student: { id: string; name: string | null } | null;
  lastMessage: ConversationMessage | null;
};
export type AdminMentorThreadDetail = {
  thread: AdminMentorThreadRow;
  messages: ConversationMessage[];
  hasOlder: boolean;
  lastReadSeq: number;
};
export type ChatMessagePage = { messages: ConversationMessage[]; hasOlder: boolean };
export type ChatSendResult =
  | { success: true; threadId: string; message: ConversationMessage }
  | { success: false; error: string };

type DatabaseError = { code?: string; message?: string } | null;

function missingChatSchema(error: DatabaseError) {
  return Boolean(error && ["42P01", "42703", "42883", "PGRST202", "PGRST204"].includes(error.code ?? ""));
}

function logChatFailure(operation: string, error: DatabaseError) {
  // SQL errors can contain private input. Keep operational logs content-free.
  console.error("mentor_chat", { operation, code: error?.code ?? "unexpected" });
}

function sendError(error: DatabaseError) {
  if (error?.code === "42501") return "Dit gesprek is niet beschikbaar. Log opnieuw in of probeer het later.";
  if (error?.code === "23505") return "Deze verzendpoging hoort bij een ander bericht. Controleer je tekst en probeer opnieuw.";
  if (error?.code === "22023") return "Controleer je bericht. Gebruik maximaal 5.000 tekens.";
  if (error?.code === "P0001" || error?.code === "53300") return "Je verstuurt veel berichten achter elkaar. Wacht even en probeer opnieuw.";
  return "Verzenden is niet bevestigd. Je bericht blijft bewaard; probeer opnieuw.";
}

export const getChatAccess = cache(async function getChatAccess(): Promise<ChatAccess> {
  const unavailable: ChatAccess = { available: false, isMentor: false, unreadCount: 0, mentor: null, missingMigration: false, error: null };
  try {
    const { student } = await ensureCurrentStudent();
    if (!student) return { ...unavailable, error: "Log in om Rousso een bericht te sturen." };
    const db = await createClient();
    const { data, error } = await db.rpc("get_my_chat_access");
    if (error) {
      logChatFailure("access", error);
      return { ...unavailable, missingMigration: missingChatSchema(error), error: "De chat is tijdelijk niet beschikbaar." };
    }
    if (!data || typeof data.available !== "boolean" || typeof data.isMentor !== "boolean") return { ...unavailable, error: "De chat is tijdelijk niet beschikbaar." };
    const mentor = data.mentor && typeof data.mentor.studentId === "string" && typeof data.mentor.displayName === "string" ? data.mentor as ChatMentor : null;
    const unreadCount = Number(data.unreadCount ?? 0);
    return { ...unavailable, available: data.available && Boolean(mentor), isMentor: data.isMentor, mentor,
      unreadCount: Number.isSafeInteger(unreadCount) && unreadCount >= 0 ? unreadCount : 0 };
  } catch {
    logChatFailure("access", null);
    return { ...unavailable, error: "De chat is tijdelijk niet beschikbaar." };
  }
});

export async function requireChatMentor() {
  const { student } = await ensureCurrentStudent();
  if (!student) redirect("/login?redirectedFrom=%2Fmentor-inbox");
  const access = await getChatAccess();
  if (!access.available || !access.isMentor) notFound();
  return { actorStudent: student, access };
}

async function getDefaultThread(studentId: string) {
  const db = await createClient();
  const { data, error } = await db.from("conversation_threads").select(THREAD_COLUMNS)
    .eq("student_id", studentId).eq("source_type", "mentor_chat").is("source_id", null).maybeSingle();
  if (error) throw error;
  return data as ConversationThread | null;
}

async function getReadSeq(threadId: string): Promise<number> {
  const db = await createClient();
  const { data, error } = await db.rpc("get_chat_read_state", { p_thread_id: threadId });
  if (error) throw error;
  const value = Number(data?.lastReadSeq ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function withChatAttachments(messages: ConversationMessage[]): Promise<ConversationMessage[]> {
  if (!messages.length) return messages;
  const db = await createClient();
  const { data, error } = await db.rpc("get_chat_message_attachments", { p_message_ids: messages.map((message) => message.id) });
  if (error) {
    // The text-only core can be rolled out before the additive attachment schema.
    if (missingChatSchema(error)) return messages;
    throw error;
  }
  const attachments = new Map<string, ChatAttachment[]>((Array.isArray(data) ? data : []).map((row: { messageId: string; attachments: ChatAttachment[] }) => [row.messageId, row.attachments]));
  return messages.map((message) => ({ ...message, attachments: attachments.get(message.id) ?? [] }));
}

export async function getChatMessagePage(threadId: string, beforeSeq?: number): Promise<ChatMessagePage> {
  if (!UUID.test(threadId) || (beforeSeq !== undefined && (!Number.isSafeInteger(beforeSeq) || beforeSeq < 1))) throw new Error("Ongeldige berichtpagina.");
  const db = await createClient();
  const thread = await db.from("conversation_threads").select("id").eq("id", threadId).eq("source_type", "mentor_chat").maybeSingle();
  if (thread.error || !thread.data) throw new Error("Gesprek niet beschikbaar.");
  let query = db.from("conversation_messages").select(MESSAGE_COLUMNS)
    .eq("thread_id", threadId).eq("is_internal", false).is("deleted_at", null)
    .order("public_seq", { ascending: false }).limit(PAGE_SIZE + 1);
  if (beforeSeq !== undefined) query = query.lt("public_seq", beforeSeq);
  const { data, error } = await measureAsync("mentor.chat.messages.page", async () => await query);
  if (error) throw error;
  const rows = (data ?? []) as ConversationMessage[];
  return { messages: await withChatAttachments(rows.slice(0, PAGE_SIZE).reverse()), hasOlder: rows.length > PAGE_SIZE };
}

/** Opening the page never creates an empty thread; the legacy API name is retained. */
export async function getOrCreateStudentMentorConversation(): Promise<{
  conversation: StudentMentorConversation | null; mentor: ChatMentor | null; missingMigration: boolean; error: string | null;
}> {
  const access = await getChatAccess();
  if (!access.available) return { conversation: null, mentor: access.mentor, missingMigration: access.missingMigration, error: access.error ?? "Rousso's chat is tijdelijk niet beschikbaar." };
  try {
    const { student } = await ensureCurrentStudent();
    if (!student) return { conversation: null, mentor: access.mentor, missingMigration: false, error: "Niet ingelogd." };
    const thread = await getDefaultThread(student.id);
    const [page, lastReadSeq] = thread ? await Promise.all([getChatMessagePage(thread.id), getReadSeq(thread.id)]) : [{ messages: [], hasOlder: false }, 0];
    return { conversation: { thread, ...page, lastReadSeq, currentStudentId: student.id }, mentor: access.mentor, missingMigration: false, error: null };
  } catch (error) {
    const dbError = error as DatabaseError;
    logChatFailure("student_read", dbError);
    return { conversation: null, mentor: access.mentor, missingMigration: missingChatSchema(dbError), error: "Je gesprek kon niet worden geladen. Probeer opnieuw." };
  }
}

type ChatSendInput = { body: string; clientMessageId: string; threadId?: string; isInternal?: boolean; attachmentIds?: string[]; uploadIntent?: string };

async function sendChatMessage(params: ChatSendInput): Promise<ChatSendResult> {
  const body = params.body.replace(/\r\n/g, "\n").trim();
  if (!body) return { success: false, error: "Schrijf eerst een bericht." };
  if (body.length > 5000) return { success: false, error: "Gebruik maximaal 5.000 tekens per bericht." };
  if (!UUID.test(params.clientMessageId) || (params.threadId && !UUID.test(params.threadId))) return { success: false, error: "De verzendpoging is niet geldig. Vernieuw de pagina; je concept blijft bewaard." };
  const attachmentIds = params.attachmentIds ?? [];
  if (attachmentIds.length > 3 || new Set(attachmentIds).size !== attachmentIds.length || attachmentIds.some((id) => !UUID.test(id)) || (attachmentIds.length > 0 && !UUID.test(params.uploadIntent ?? ""))) return { success: false, error: "Controleer de screenshots en probeer opnieuw." };
  try {
    const { student } = await ensureCurrentStudent();
    if (!student) return { success: false, error: "Je sessie is verlopen. Log opnieuw in; je concept blijft bewaard." };
    const db = await createClient();
    const args = {
      p_body: body, p_client_message_id: params.clientMessageId, p_thread_id: params.threadId ?? null, p_is_internal: Boolean(params.isInternal),
    };
    const { data, error } = attachmentIds.length
      ? await db.rpc("send_chat_message_with_attachments", { ...args, p_attachment_ids: attachmentIds, p_upload_intent: params.uploadIntent })
      : await db.rpc("send_chat_message", args);
    if (error) { logChatFailure("send", error); return { success: false, error: sendError(error) }; }
    if (!data?.threadId || !data?.message?.id) return { success: false, error: "Verzenden is niet bevestigd. Probeer opnieuw met hetzelfde bericht." };
    return { success: true, threadId: data.threadId, message: data.message as ConversationMessage };
  } catch {
    logChatFailure("send", null);
    return { success: false, error: "Verzenden is niet bevestigd. Je concept blijft bewaard; probeer opnieuw." };
  }
}

export async function createStudentMentorMessage(body: string, clientMessageId: string, files?: Pick<ChatSendInput, "attachmentIds" | "uploadIntent">): Promise<ChatSendResult> {
  return sendChatMessage({ body, clientMessageId, ...files });
}

export async function createAdminMentorMessage(params: ChatSendInput & { threadId: string }): Promise<ChatSendResult> {
  await requireChatMentor();
  return sendChatMessage(params);
}

export async function markStudentMentorThreadRead(threadId: string, seenSeq: number) {
  if (!UUID.test(threadId) || !Number.isSafeInteger(seenSeq) || seenSeq < 0) return { success: false as const, error: "Ongeldige gelezenstatus." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("mark_chat_read", { p_thread_id: threadId, p_seen_seq: seenSeq });
    if (error) { logChatFailure("mark_read", error); return { success: false as const, error: "Gelezenstatus is nog niet bijgewerkt." }; }
    return { success: true as const };
  } catch { return { success: false as const, error: "Gelezenstatus is nog niet bijgewerkt." }; }
}

export async function markAdminMentorThreadRead(threadId: string, seenSeq: number) {
  await requireChatMentor();
  return markStudentMentorThreadRead(threadId, seenSeq);
}

export async function listAdminMentorThreads(params: { status?: string; q?: string; selectedThreadId?: string; limit?: number; cursor?: string }): Promise<{
  rows: AdminMentorThreadRow[]; selectedThreadId: string | null; selectedThread: AdminMentorThreadRow | null;
  missingMigration: boolean; hasMore: boolean; nextCursor: string | null; error: string | null;
}> {
  const empty = { rows: [] as AdminMentorThreadRow[], selectedThreadId: null, selectedThread: null, missingMigration: false, hasMore: false, nextCursor: null, error: null };
  const access = await getChatAccess();
  // Other admins call this from their dashboard and must receive no chat data.
  if (!access.available || !access.isMentor) return { ...empty, missingMigration: access.missingMigration };
  const db = await createClient();
  const { data, error } = await measureAsync("mentor.inbox.query", async () => await db.rpc("get_mentor_inbox", {
    p_status: params.status ?? "active", p_query: (params.q ?? "").trim().slice(0, 200),
    p_limit: Math.min(100, Math.max(1, params.limit ?? 40)), p_cursor: params.cursor ?? null,
    p_selected_thread_id: params.selectedThreadId && UUID.test(params.selectedThreadId) ? params.selectedThreadId : null,
  }));
  if (error) { logChatFailure("inbox", error); return { ...empty, missingMigration: missingChatSchema(error), error: "De inbox kon niet worden geladen. Probeer opnieuw." }; }
  const rows = Array.isArray(data?.rows) ? data.rows as AdminMentorThreadRow[] : [];
  const selectedThread = (data?.selectedThread as AdminMentorThreadRow | null) ?? (params.selectedThreadId ? null : rows[0] ?? null);
  return { rows, selectedThread, selectedThreadId: selectedThread?.id ?? null, missingMigration: false, hasMore: Boolean(data?.hasMore), nextCursor: typeof data?.nextCursor === "string" ? data.nextCursor : null, error: null };
}

export async function getAdminMentorThreadDetail(threadId: string | null): Promise<AdminMentorThreadDetail | null> {
  await requireChatMentor();
  if (!threadId || !UUID.test(threadId)) return null;
  const db = await createClient();
  const [inbox, page, lastReadSeq, notes] = await Promise.all([
    listAdminMentorThreads({ selectedThreadId: threadId, limit: 1 }), getChatMessagePage(threadId), getReadSeq(threadId),
    db.from("conversation_messages").select(MESSAGE_COLUMNS).eq("thread_id", threadId).eq("is_internal", true).is("deleted_at", null).order("created_at", { ascending: false }).limit(30),
  ]);
  if (!inbox.selectedThread || notes.error) return null;
  return { thread: inbox.selectedThread, hasOlder: page.hasOlder, lastReadSeq,
    messages: [...page.messages, ...await withChatAttachments((notes.data ?? []) as ConversationMessage[])].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
  };
}

export async function updateAdminMentorThread(params: { threadId: string; status?: ConversationThreadStatus; priority?: ConversationThreadPriority; category?: string | null }) {
  await requireChatMentor();
  if (!UUID.test(params.threadId)) return { error: "Ongeldig gesprek." };
  const db = await createClient();
  const { error } = await db.rpc("update_chat_thread", { p_thread_id: params.threadId, p_status: params.status ?? null, p_priority: params.priority ?? null,
    p_category: params.category === undefined ? null : (params.category ?? "").trim().slice(0, 100) });
  if (error) logChatFailure("update_thread", error);
  return { error: error ? "Gesprek bijwerken is niet gelukt. Probeer opnieuw." : null };
}
