/** Verify the privacy-only migration against the existing direct-write app contract.
 * LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx tests/chat/privacy-slice.integration.ts
 * Local only. All synthetic accounts and prior local routing are restored.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function ok<T extends { error: unknown }>(result: T, label: string): T {
  assert.equal(result.error, null, `${label}: ${JSON.stringify(result.error)}`);
  return result;
}
async function main() {
  const path = process.env.LOCAL_SUPABASE_ENV_FILE;
  if (!path) throw new Error("LOCAL_SUPABASE_ENV_FILE is required.");
  const env = Object.fromEntries([...readFileSync(path, "utf8").matchAll(/^([A-Z_]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]));
  if (!env.API_URL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.API_URL).hostname)) throw new Error("Local Supabase required; refusing remote integration writes.");
  const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymous = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  const originalConfig = ok(await service.from("chat_mentor_config").select("*").single(), "snapshot mentor config").data!;
  const assignments = ok(await service.from("conversation_threads").select("id,assigned_to_student_id").eq("source_type", "mentor_chat"), "snapshot assignments").data!;
  const oldEvents = ok(await service.from("notification_events").select("id").eq("type", "mentor_new_message"), "snapshot old chat events").data!;
  const deliveries = oldEvents.length ? ok(await service.from("notification_recipients").select("id,archived_at").in("event_id", oldEvents.map((event) => event.id)), "snapshot notification delivery").data! : [];
  const users: Array<{ userId: string; studentId: string; db: SupabaseClient }> = [];
  const authUserIds: string[] = [];
  let threadId: string | null = null;
  try {
    for (const [index, level] of [1, 1, 1, 3].entries()) {
      const email = `chat-compatibility-${randomUUID()}@example.invalid`; const password = randomUUID();
      const account = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }), "create real account").data.user!;
      authUserIds.push(account.id);
      const profile = ok(await service.from("students").insert({ auth_user_id: account.id, email, name: index === 2 ? "Rousso" : `Compatibility fixture ${index}`, phone: "+32470123456", access_level: level }).select("id").single(), "create profile").data!;
      const db = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      ok(await db.auth.signInWithPassword({ email, password }), "authenticate fixture");
      users.push({ userId: account.id, studentId: profile.id, db });
    }
    const [student, otherStudent, rousso, otherAdmin] = users;
    ok(await service.rpc("configure_chat_mentor", { p_student_id: rousso.studentId }), "configure non-admin Rousso");
    const thread = ok(await student.db.from("conversation_threads").insert({ student_id: student.studentId, source_type: "mentor_chat", subject: "Mentorgesprek" }).select("*").single(), "old app free thread insert").data!;
    threadId = thread.id;
    assert.equal(thread.assigned_to_student_id, rousso.studentId, "legacy null assignment is safely routed");
    const question = ok(await student.db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: student.studentId, sender_role: "student", body: "Legacy free student question", body_format: "plain", client_message_id: randomUUID() }).select("*").single(), "old app student direct send").data!;
    const questionEvent = ok(await service.from("notification_events").select("*").eq("target_id", threadId).single(), "legacy routed question event").data!;
    const recipients = ok(await service.from("notification_recipients").select("student_id").eq("event_id", questionEvent.id), "legacy routed recipients").data!;
    assert.deepEqual(recipients.map((recipient) => recipient.student_id), [rousso.studentId]);
    assert.equal(questionEvent.body.includes(question.body), false, "notification carries no private message copy");
    assert.equal(ok(await rousso.db.from("conversation_messages").select("id").eq("thread_id", threadId), "configured mentor sees old message").data!.length, 1);
    ok(await rousso.db.rpc("mark_mentor_conversation_read", { p_thread_id: threadId }), "old mentor mark read");
    assert.equal(ok(await service.from("conversation_threads").select("unread_for_mentor_count").eq("id", threadId).single(), "mentor count after old read").data!.unread_for_mentor_count, 0);
    const reply = ok(await rousso.db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: rousso.studentId, sender_role: "mentor", body: "Legacy Rousso reply", body_format: "plain", client_message_id: randomUUID() }).select("id").single(), "old mentor reply insert").data!;
    assert.equal(ok(await student.db.from("conversation_messages").select("id").eq("id", reply.id), "student sees reply").data!.length, 1);
    ok(await student.db.rpc("mark_student_conversation_read", { p_thread_id: threadId }), "old student mark read");
    assert.equal(ok(await service.from("conversation_threads").select("unread_for_student_count").eq("id", threadId).single(), "student count after old read").data!.unread_for_student_count, 0);
    const beforeNote = ok(await service.from("conversation_threads").select("last_message_at,unread_for_student_count,unread_for_mentor_count,status").eq("id", threadId).single(), "before old internal note").data!;
    const note = ok(await rousso.db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: rousso.studentId, sender_role: "admin", body: "Legacy private note", is_internal: true, client_message_id: randomUUID() }).select("id").single(), "old internal note insert").data!;
    assert.deepEqual(ok(await service.from("conversation_threads").select("last_message_at,unread_for_student_count,unread_for_mentor_count,status").eq("id", threadId).single(), "after old internal note").data, beforeNote);
    assert.deepEqual(ok(await student.db.from("conversation_messages").select("id").eq("id", note.id), "old internal note privacy").data, []);
    console.log("PASS: privacy-only slice preserves the old direct thread/message/reply/internal-note contract and both mark-read RPCs; free members send and only configured non-admin Rousso receives questions.");

    // A stale delivery to an unrelated admin must never act as authorization.
    ok(await service.from("notification_recipients").insert({ event_id: questionEvent.id, student_id: otherAdmin.studentId }), "seed historical over-delivery");
    for (const user of [otherStudent, otherAdmin]) {
      for (const [table, key, value] of [["conversation_threads", "id", threadId], ["conversation_messages", "thread_id", threadId], ["conversation_events", "thread_id", threadId], ["notification_events", "target_id", threadId], ["notification_recipients", "event_id", questionEvent.id]] as const) {
        assert.deepEqual(ok(await user.db.from(table).select("*").eq(key, value), `legacy ${table} privacy`).data, []);
      }
      assert.equal(ok(await user.db.rpc("get_my_notification_shell"), "legacy shell privacy").data.unreadCount, 0);
      assert.ok((await user.db.rpc("mark_student_conversation_read", { p_thread_id: threadId })).error);
      assert.ok((await user.db.rpc("mark_mentor_conversation_read", { p_thread_id: threadId })).error);
      assert.ok((await user.db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: rousso.studentId, sender_role: "mentor", body: "Forged legacy mentor" })).error);
      assert.ok((await user.db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: user.studentId, sender_role: "student", body: "Forged cross-student message" })).error);
      const update = await user.db.from("conversation_threads").update({ assigned_to_student_id: otherAdmin.studentId, status: "closed" }).eq("id", threadId).select("id");
      assert.ok(update.error || update.data?.length === 0);
    }
    assert.ok((await student.db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: student.studentId, sender_role: "mentor", body: "Student forging mentor role" })).error);
    assert.ok((await student.db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: student.studentId, sender_role: "student", body: "Student internal forgery", is_internal: true })).error);
    assert.ok((await otherAdmin.db.from("notification_events").insert({ type: "mentor_new_message", target_table: "conversation_threads", target_id: threadId, title: "Forged legacy event" })).error);
    assert.ok((await otherAdmin.db.rpc("configure_chat_mentor", { p_student_id: otherAdmin.studentId })).error);
    const anonRead = await anonymous.from("conversation_messages").select("id").eq("thread_id", threadId);
    assert.ok(anonRead.error || anonRead.data?.length === 0);
    console.log("PASS: privacy-only slice blocks other-admin, other-student and anonymous reads/writes, stale notification/shell leaks, forged authors/internal flags and unauthorized routing.");
  } finally {
    if (threadId) {
      ok(await service.from("notification_events").delete().eq("target_table", "conversation_threads").eq("target_id", threadId), "clean synthetic events");
      ok(await service.from("conversation_threads").delete().eq("id", threadId), "clean synthetic thread");
    }
    ok(await service.from("chat_mentor_config").upsert(originalConfig), "restore local mentor config");
    for (const assignment of assignments) ok(await service.from("conversation_threads").update({ assigned_to_student_id: assignment.assigned_to_student_id }).eq("id", assignment.id), "restore local assignment");
    for (const delivery of deliveries) ok(await service.from("notification_recipients").update({ archived_at: delivery.archived_at }).eq("id", delivery.id), "restore local delivery");
    if (users.length) ok(await service.from("students").delete().in("id", users.map((user) => user.studentId)), "clean synthetic students");
    for (const id of authUserIds) ok(await service.auth.admin.deleteUser(id), "clean synthetic account");
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
