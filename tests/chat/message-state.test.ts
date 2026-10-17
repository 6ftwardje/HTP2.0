import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_DRAFT_TTL_MS,
  acknowledgedChatDraft,
  chatDraftKey,
  chatSenderLabel,
  clearChatDrafts,
  editChatDraft,
  hasUnreadHistoryGap,
  mergeChatMessages,
  newChatDraft,
  parseChatDraft,
  removeChatDraft,
  restoreChatDraft,
  saveChatDraft,
  serializeChatDraft,
  setChatDraftAttachments,
} from "../../lib/chat-message-state.ts";
import type { ConversationMessage } from "../../lib/types.ts";

function message(id: string, seq: number | null, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id, public_seq: seq, thread_id: "thread-a", sender_student_id: "student-a", sender_role: "student",
    body: id, body_format: "plain", client_message_id: null, status: "sent", is_internal: false,
    parent_message_id: null, metadata: {}, created_at: "2026-10-14T10:00:00.000Z", edited_at: null,
    deleted_at: null, sender_principal_id: "principal-a", sender_participant_id: "participant-a", ...overrides,
  };
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function withStorage(run: (storage: MemoryStorage) => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", { value: { sessionStorage: storage }, configurable: true });
  try { run(storage); }
  finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("public server sequence remains authoritative under skewed and equal timestamps", () => {
  const early = message("first", 1, { created_at: "2026-10-14T11:00:00.000Z" });
  const middle = message("middle", 2, { created_at: "2026-10-14T09:00:00.000Z" });
  const last = message("last", 3, { created_at: middle.created_at });
  assert.deepEqual(mergeChatMessages([last, early], [middle]).map((item) => item.id), ["first", "middle", "last"]);
});

test("a realtime duplicate and canonical retry acknowledgement merge into one updated message", () => {
  const first = message("first", 1);
  const original = message("retry", 2, { client_message_id: "same-send-intent", status: "sent" });
  const ack = { ...original, status: "read" as const, body: "Canonical normalized body" };
  const merged = mergeChatMessages([first, original], [original], [ack]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[1], ack);
  assert.deepEqual(merged[0], first);
});

test("private notes appear chronologically without disturbing public sequence order", () => {
  const first = message("first", 1, { created_at: "2026-10-14T10:00:00.000Z" });
  const last = message("last", 2, { created_at: "2026-10-14T12:00:00.000Z" });
  const note = message("note", null, { is_internal: true, created_at: "2026-10-14T11:00:00.000Z" });
  const before = message("before", null, { is_internal: true, created_at: "2026-10-14T09:00:00.000Z" });
  const merged = mergeChatMessages([last, note], [first, before]);
  assert.deepEqual(merged.map((item) => item.id), ["before", "first", "note", "last"]);
  assert.deepEqual(merged.filter((item) => !item.is_internal).map((item) => item.public_seq), [1, 2]);
});

test("unchanged retries retain their send identity; changed body or private mode creates a fresh intent", () => {
  const blank = newChatDraft();
  const written = editChatDraft(blank, { body: "Vraag voor Rousso" });
  assert.notEqual(written.clientMessageId, blank.clientMessageId);
  assert.equal(editChatDraft(written, {}), written);
  assert.equal(editChatDraft(written, { body: written.body, internal: false }), written);
  const amended = editChatDraft(written, { body: "Vraag voor Rousso, met aanvulling" });
  const internal = editChatDraft(written, { internal: true });
  assert.notEqual(amended.clientMessageId, written.clientMessageId);
  assert.notEqual(internal.clientMessageId, written.clientMessageId);
  assert.notEqual(editChatDraft(amended, { body: written.body }).clientMessageId, written.clientMessageId);
  assert.equal(internal.body, written.body);
});

test("draft keys isolate accounts, selected conversations and the new-conversation composer", () => {
  const keys = [chatDraftKey("student-a", "thread-a"), chatDraftKey("student-b", "thread-a"), chatDraftKey("student-a", "thread-b"), chatDraftKey("student-a", null)];
  assert.equal(new Set(keys).size, keys.length);
});

test("screenshots keep their upload intent across edits and change the send identity when the payload changes", () => withStorage(() => {
  const draft = newChatDraft();
  const file = { id: crypto.randomUUID(), fileName: "chart.png", mediaType: "image/png", sizeBytes: 1024, width: 1200, height: 800 };
  const withFile = setChatDraftAttachments(draft, [file]);
  assert.equal(withFile.uploadIntent, draft.uploadIntent);
  assert.notEqual(withFile.clientMessageId, draft.clientMessageId);
  const written = editChatDraft(withFile, { body: "Waar plaats ik mijn stop?" });
  assert.equal(written.uploadIntent, draft.uploadIntent);
  assert.deepEqual(written.attachments, [file]);
  saveChatDraft("student-a", null, withFile);
  assert.deepEqual(restoreChatDraft("student-a", null), withFile, "an uploaded screenshot survives reload before its caption is written");
  const removed = setChatDraftAttachments(written, []);
  assert.notEqual(removed.clientMessageId, written.clientMessageId);
  assert.notEqual(removed.uploadIntent, written.uploadIntent, "readding a screenshot starts a fresh upload even if the previous send committed");
  const malformed = { ...written, attachments: [{ ...file, id: "../private" }] };
  assert.equal(parseChatDraft(serializeChatDraft(malformed)), null);
}));

test("canonical history acknowledges a lost response only for the same author, content and attachment payload", () => {
  const file = { id: crypto.randomUUID(), fileName: "chart.webp", mediaType: "image/webp", sizeBytes: 1024, width: 1200, height: 800 };
  const draft = editChatDraft(setChatDraftAttachments(newChatDraft(), [file]), { body: "  Mijn vraag\r\nmet screenshot  " });
  const committed = message("saved", 5, { body: "Mijn vraag\nmet screenshot", client_message_id: draft.clientMessageId, attachments: [file] });
  assert.equal(acknowledgedChatDraft(draft, "student-a", [committed]), committed);
  assert.equal(acknowledgedChatDraft(draft, "student-b", [committed]), undefined);
  assert.equal(acknowledgedChatDraft(editChatDraft(draft, { body: "Andere vraag" }), "student-a", [committed]), undefined);
  assert.equal(acknowledgedChatDraft({ ...draft, attachments: [] }, "student-a", [committed]), undefined);
  assert.equal(acknowledgedChatDraft({ ...draft, internal: true }, "student-a", [committed]), undefined);
});

test("restored drafts expire after one day and reject malformed or untrusted storage", () => {
  const now = 1_000_000;
  const draft = editChatDraft(newChatDraft(), { body: "Nog niet verstuurd" });
  const serialized = serializeChatDraft(draft, now);
  assert.deepEqual(parseChatDraft(serialized, now), draft);
  assert.deepEqual(parseChatDraft(serialized, now + CHAT_DRAFT_TTL_MS - 1), draft);
  assert.equal(parseChatDraft(serialized, now + CHAT_DRAFT_TTL_MS), null);
  for (const value of [null, "", "{broken", "null", "[]", JSON.stringify({ version: 2, expiresAt: now + 1, draft }), JSON.stringify({ version: 1, expiresAt: now + CHAT_DRAFT_TTL_MS + 1, draft }), JSON.stringify({ version: 1, expiresAt: now + 1, draft: { ...draft, clientMessageId: "forged" } }), JSON.stringify({ version: 1, expiresAt: now + 1, draft: { ...draft, body: "x".repeat(5001) } }), JSON.stringify({ version: 1, expiresAt: now + 1, draft: { ...draft, internal: "true" } })]) {
    assert.equal(parseChatDraft(value, now), null);
  }
});

test("a late successful send cannot erase a newer draft and sign-out clears only the intended account", () => withStorage((storage) => {
  const sending = editChatDraft(newChatDraft(), { body: "Bericht onderweg" });
  saveChatDraft("student-a", "thread-a", sending);
  const next = editChatDraft(sending, { body: "Volgende vraag" });
  saveChatDraft("student-a", "thread-a", next);
  removeChatDraft("student-a", "thread-a", sending.clientMessageId);
  assert.deepEqual(restoreChatDraft("student-a", "thread-a"), next);
  saveChatDraft("student-b", "thread-a", sending);
  saveChatDraft("student-a", "thread-b", sending);
  clearChatDrafts("student-a");
  assert.equal(restoreChatDraft("student-a", "thread-a"), null);
  assert.equal(restoreChatDraft("student-a", "thread-b"), null);
  assert.deepEqual(restoreChatDraft("student-b", "thread-a"), sending);
  storage.setItem("unrelated-setting", "keep");
  clearChatDrafts();
  assert.equal(restoreChatDraft("student-b", "thread-a"), null);
  assert.equal(storage.getItem("unrelated-setting"), "keep");
}));

test("expired storage is removed and successful sends remove only their own stored draft", () => withStorage((storage) => {
  const draft = editChatDraft(newChatDraft(), { body: "Concept" });
  const key = chatDraftKey("student-a", null);
  storage.setItem(key, serializeChatDraft(draft, Date.now() - CHAT_DRAFT_TTL_MS - 1));
  assert.equal(restoreChatDraft("student-a", null), null);
  assert.equal(storage.getItem(key), null);
  saveChatDraft("student-a", null, draft);
  removeChatDraft("student-a", null, draft.clientMessageId);
  assert.equal(storage.getItem(key), null);
}));

test("unread history gaps cannot be hidden by private notes or a recent message page", () => {
  const page = [message("private", null, { is_internal: true }), message("first-visible", 51), message("latest", 100)];
  assert.equal(hasUnreadHistoryGap(page, 10, true), true);
  assert.equal(hasUnreadHistoryGap(page, 50, true), false);
  assert.equal(hasUnreadHistoryGap(page, 10, false), false);
  assert.equal(hasUnreadHistoryGap([], 0, true), false);
  assert.equal(hasUnreadHistoryGap([page[0]], 0, true), false);
});

test("historical mentors keep their identity while AI and system messages remain explicit", () => {
  const historical = message("old-mentor", 1, { sender_role: "mentor", sender_student_id: "historical-mentor", sender_principal_id: "historical-principal" });
  assert.equal(chatSenderLabel(historical, "student-a", "rouss"), "Mentor");
  assert.equal(chatSenderLabel({ ...historical, sender_student_id: null }, "student-a", "rouss"), "Mentor");
  assert.equal(chatSenderLabel({ ...historical, sender_student_id: "rouss" }, "student-a", "rouss"), "Mentor");
  assert.equal(chatSenderLabel(message("own", 2), "student-a", "rouss"), "Jij");
  assert.equal(chatSenderLabel(message("student", 2), "rouss", "rouss", "Student A"), "Student A");
  assert.equal(chatSenderLabel({ ...historical, sender_role: "ai", sender_student_id: "rouss" }, "student-a", "rouss"), "AI-assistent");
  assert.equal(chatSenderLabel({ ...historical, sender_role: "system" }, "student-a", "rouss"), "Systeembericht");
});
