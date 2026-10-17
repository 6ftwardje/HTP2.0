import type { ChatAttachment, ConversationMessage } from "@/lib/types";

export type ChatDraft = { body: string; clientMessageId: string; internal: boolean; uploadIntent?: string; attachments?: ChatAttachment[] };
export const CHAT_DRAFT_PREFIX = "htp-chat-draft:";
export const CHAT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newChatDraft(): ChatDraft {
  return { body: "", clientMessageId: crypto.randomUUID(), internal: false, uploadIntent: crypto.randomUUID(), attachments: [] };
}

/** Retrying unchanged content reuses its key; editing starts a new logical message. */
export function editChatDraft(draft: ChatDraft, changes: Partial<Pick<ChatDraft, "body" | "internal">>): ChatDraft {
  const next = { ...draft, ...changes };
  return next.body === draft.body && next.internal === draft.internal ? draft : { ...next, clientMessageId: crypto.randomUUID() };
}

export function setChatDraftAttachments(draft: ChatDraft, attachments: ChatAttachment[]): ChatDraft {
  return { ...draft, attachments, uploadIntent: attachments.length ? draft.uploadIntent ?? draft.clientMessageId : crypto.randomUUID(), clientMessageId: crypto.randomUUID() };
}

/** A refreshed canonical record can acknowledge a send whose response was lost. */
export function acknowledgedChatDraft(draft: ChatDraft, studentId: string, messages: ConversationMessage[]) {
  const files = (draft.attachments ?? []).map((file) => file.id).sort().join(":");
  return messages.find((message) => message.sender_student_id === studentId && message.client_message_id === draft.clientMessageId
    && message.body === draft.body.replace(/\r\n/g, "\n").trim() && message.is_internal === draft.internal
    && (message.attachments ?? []).map((file) => file.id).sort().join(":") === files);
}

export function chatDraftKey(studentId: string, threadId: string | null) {
  return `${CHAT_DRAFT_PREFIX}${studentId}:${threadId ?? "new"}`;
}

export function serializeChatDraft(draft: ChatDraft, now = Date.now()) {
  return JSON.stringify({ version: 1, expiresAt: now + CHAT_DRAFT_TTL_MS, draft });
}

export function parseChatDraft(value: string | null, now = Date.now()): ChatDraft | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const entry = parsed as { version?: unknown; expiresAt?: unknown; draft?: unknown };
    if (entry.version !== 1 || typeof entry.expiresAt !== "number" || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now || entry.expiresAt > now + CHAT_DRAFT_TTL_MS || !entry.draft || typeof entry.draft !== "object") return null;
    const draft = entry.draft as Partial<ChatDraft>;
    if (typeof draft.body !== "string" || draft.body.length > 5000 || typeof draft.internal !== "boolean" || typeof draft.clientMessageId !== "string" || !UUID.test(draft.clientMessageId)) return null;
    if (draft.uploadIntent !== undefined && (typeof draft.uploadIntent !== "string" || !UUID.test(draft.uploadIntent))) return null;
    if (draft.attachments !== undefined && (!Array.isArray(draft.attachments) || draft.attachments.length > 3 || draft.attachments.some((file) => !file || typeof file.id !== "string" || !UUID.test(file.id) || typeof file.fileName !== "string" || file.fileName.length > 180 || !["image/png", "image/jpeg", "image/webp"].includes(file.mediaType) || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0 || file.sizeBytes > 4 * 1024 * 1024 || !Number.isSafeInteger(file.width) || file.width <= 0 || !Number.isSafeInteger(file.height) || file.height <= 0))) return null;
    return draft as ChatDraft;
  } catch { return null; }
}

export function restoreChatDraft(studentId: string, threadId: string | null): ChatDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const key = chatDraftKey(studentId, threadId);
    const value = window.sessionStorage.getItem(key);
    const draft = parseChatDraft(value);
    if (value && !draft) window.sessionStorage.removeItem(key);
    return draft;
  } catch { return null; }
}

export function saveChatDraft(studentId: string, threadId: string | null, draft: ChatDraft) {
  if (typeof window === "undefined") return;
  try {
    const key = chatDraftKey(studentId, threadId);
    if (draft.body.length === 0 && !draft.attachments?.length) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, serializeChatDraft(draft));
  } catch { /* Private browsing or exhausted storage must not block the composer. */ }
}

export function removeChatDraft(studentId: string, threadId: string | null, sentId?: string) {
  if (typeof window === "undefined") return;
  try {
    const key = chatDraftKey(studentId, threadId);
    if (!sentId || parseChatDraft(window.sessionStorage.getItem(key))?.clientMessageId === sentId) window.sessionStorage.removeItem(key);
  } catch { /* Storage is optional. */ }
}

export function clearChatDrafts(studentId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const prefix = studentId ? `${CHAT_DRAFT_PREFIX}${studentId}:` : CHAT_DRAFT_PREFIX;
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index));
    for (const key of keys) if (key?.startsWith(prefix)) window.sessionStorage.removeItem(key);
  } catch { /* Sign-out remains available when storage is restricted. */ }
}

/** Canonical acknowledgements replace retries; client timestamps never reorder public history. */
export function mergeChatMessages(...groups: ConversationMessage[][]): ConversationMessage[] {
  const byId = new Map<string, ConversationMessage>();
  for (const group of groups) for (const message of group) byId.set(message.id, message);
  const all = [...byId.values()];
  const publicMessages = all.filter((message) => !message.is_internal).sort((a, b) => {
    if (a.public_seq !== null && b.public_seq !== null) return a.public_seq - b.public_seq || a.id.localeCompare(b.id);
    if (a.public_seq !== null) return -1;
    if (b.public_seq !== null) return 1;
    return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  });
  const notes = all.filter((message) => message.is_internal).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const buckets = new Map<number, ConversationMessage[]>();
  for (const note of notes) {
    let afterIndex = -1;
    for (let index = 0; index < publicMessages.length; index++) {
      if (publicMessages[index].created_at <= note.created_at) afterIndex = index;
    }
    buckets.set(afterIndex, [...(buckets.get(afterIndex) ?? []), note]);
  }
  return [...(buckets.get(-1) ?? []), ...publicMessages.flatMap((message, index) => [message, ...(buckets.get(index) ?? [])])];
}

export function hasUnreadHistoryGap(messages: ConversationMessage[], lastReadSeq: number, hasOlder: boolean) {
  const firstSeq = messages.find((message) => !message.is_internal && message.public_seq !== null)?.public_seq ?? 0;
  return hasOlder && firstSeq > lastReadSeq + 1;
}

export function chatSenderLabel(message: ConversationMessage, currentStudentId: string, mentorId: string, studentName = "Student") {
  if (message.is_internal) return "Interne notitie · alleen voor jou";
  if (message.sender_role === "ai") return "AI-assistent";
  if (message.sender_role === "system") return "Systeembericht";
  if (message.sender_student_id === currentStudentId) return "Jij";
  if (message.sender_student_id === mentorId) return "Mentor";
  if (message.sender_role === "student") return studentName;
  return "Mentor";
}
