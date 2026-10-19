/** Real authenticated privacy/routing verification against local Supabase only.
 * LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx scripts/verify-mentor-chat-local.ts
 * Add --keep for synthetic browser fixtures; --cleanup removes them and restores local routing.
 * Keys, cookies and passwords are written only to the mode-0600 fixture file, never stdout.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

type Row = Record<string, any>;
type User = { userId: string; studentId: string; email: string; password: string; cookie: string; db: SupabaseClient };
type Fixtures = {
  users: Array<Omit<User, "db">>;
  previousConfig: Row | null;
  previousAssignments: Row[];
  previousMentorParticipants: Row[];
  previousNotificationRecipients: Row[];
  threadIds: string[];
};
const fixtureFile = process.env.LOCAL_CHAT_FIXTURE_FILE ?? "/tmp/htp-chat-fixtures.json";

function localEnvironment() {
  const path = process.env.LOCAL_SUPABASE_ENV_FILE;
  if (!path) throw new Error("Set LOCAL_SUPABASE_ENV_FILE to local supabase status -o env output.");
  const values = Object.fromEntries([...readFileSync(path, "utf8").matchAll(/^([A-Z_]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]));
  if (!values.API_URL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(values.API_URL).hostname)) {
    throw new Error("Local Supabase required; refusing remote integration writes.");
  }
  if (!values.ANON_KEY || !values.SERVICE_ROLE_KEY) throw new Error("Local Supabase keys are missing.");
  return values;
}

function ok<T extends { error: unknown }>(result: T, label: string): T {
  assert.equal(result.error, null, `${label}: ${JSON.stringify(result.error)}`);
  return result;
}

async function main() {
  const env = localEnvironment();
  const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymous = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const users: User[] = [];
  const previousNotificationRecipients: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = ok(await service.from("notification_recipients")
      .select("id,archived_at,notification_events!inner(type)").eq("notification_events.type", "mentor_new_message")
      .order("id").range(offset, offset + 499), "snapshot old notification delivery").data ?? [];
    previousNotificationRecipients.push(...page.map(({ id, archived_at }) => ({ id, archived_at })));
    if (page.length < 500) break;
  }
  const state: Fixtures = {
    users: [],
    previousConfig: ok(await service.from("chat_mentor_config").select("*").maybeSingle(), "read initial routing").data,
    previousAssignments: ok(await service.from("conversation_threads").select("id,assigned_to_student_id,chat_version,unread_for_student_count,unread_for_mentor_count").eq("source_type", "mentor_chat"), "snapshot routing").data ?? [],
    previousMentorParticipants: ok(await service.from("conversation_participants").select("*").eq("role", "mentor"), "snapshot participants").data ?? [],
    previousNotificationRecipients,
    threadIds: [],
  };

  async function clean(fixtures: Fixtures) {
    const studentIds = fixtures.users.map((user) => user.studentId);
    const actualThreads = studentIds.length ? ok(await service.from("conversation_threads").select("id").in("student_id", studentIds), "find fixture threads").data ?? [] : [];
    const threadIds = [...new Set([...fixtures.threadIds, ...actualThreads.map((thread) => thread.id)])];
    if (threadIds.length) {
      ok(await service.from("notification_events").delete().eq("target_table", "conversation_threads").in("target_id", threadIds), "clean chat notifications");
      ok(await service.from("conversation_threads").delete().in("id", threadIds), "clean chat threads");
    }
    if (fixtures.previousConfig) {
      ok(await service.from("chat_mentor_config").upsert(fixtures.previousConfig), "restore routing config");
    } else {
      ok(await service.from("chat_mentor_config").delete().eq("singleton", true), "restore unconfigured routing");
    }
    // Configuration touches existing mentor memberships. Restore the exact prior rows,
    // including inactive memberships, before deleting synthetic identities.
    if (fixtures.previousAssignments.length) {
      const ids = fixtures.previousAssignments.map((row) => row.id);
      const temporaryPrincipals = studentIds.length ? ok(await service.from("chat_principals").select("id").in("student_id", studentIds), "find temporary mentor identities").data ?? [] : [];
      if (temporaryPrincipals.length) ok(await service.from("conversation_participants").delete().eq("role", "mentor").in("thread_id", ids).in("principal_id", temporaryPrincipals.map((principal) => principal.id)), "remove temporary mentor memberships");
      if (fixtures.previousMentorParticipants.length) ok(await service.from("conversation_participants").upsert(fixtures.previousMentorParticipants), "restore mentor memberships");
      for (const thread of fixtures.previousAssignments) {
        const { id, ...previous } = thread;
        ok(await service.from("conversation_threads").update(previous).eq("id", id), "restore assignment and counters");
      }
    }
    for (const recipient of fixtures.previousNotificationRecipients) ok(await service.from("notification_recipients").update({ archived_at: recipient.archived_at }).eq("id", recipient.id), "restore old notification delivery");
    if (studentIds.length) {
      ok(await service.from("chat_principals").delete().in("student_id", studentIds), "clean synthetic principals");
      ok(await service.from("students").delete().in("id", studentIds), "clean synthetic student profiles");
    }
    for (const user of fixtures.users) ok(await service.auth.admin.deleteUser(user.userId), "clean synthetic auth user");
  }

  if (process.argv.includes("--cleanup")) {
    await clean(JSON.parse(readFileSync(fixtureFile, "utf8")) as Fixtures);
    unlinkSync(fixtureFile);
    console.log("PASS: synthetic mentor-chat fixtures removed; prior local routing restored.");
    return;
  }

  try {
    for (const [index, accessLevel] of [1, 1, 1, 3].entries()) {
      const email = `chat-verification-${randomUUID()}@example.invalid`;
      const password = randomUUID();
      const created = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }), "create authenticated fixture");
      assert.ok(created.data.user);
      const userId = created.data.user.id;
      // Persist partial cleanup state before creating a profile or signing in.
      const placeholder = { userId, studentId: randomUUID(), email, password, cookie: "" };
      state.users.push(placeholder);
      const student = ok(await service.from("students").insert({ id: placeholder.studentId, auth_user_id: userId, email, name: ["Verificatie gratis lid A", "Verificatie gratis lid B", "Rousso", "Andere beheerder"][index], phone: "+32470123456", access_level: accessLevel }).select("id").single(), "create free/admin profile");
      assert.equal(student.data!.id, placeholder.studentId);
      const cookies = new Map<string, string>();
      const db = createServerClient(env.API_URL, env.ANON_KEY, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: (changes: Array<{ name: string; value: string }>) => changes.forEach(({ name, value }) => cookies.set(name, value)) } });
      ok(await db.auth.signInWithPassword({ email, password }), "sign in fixture");
      placeholder.cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      users.push({ ...placeholder, db });
    }
    const [first, second, rousso, otherAdmin] = users;
    const configure = () => service.rpc("configure_chat_mentor", { p_student_id: rousso.studentId });
    ok(await configure(), "configure Rousso without admin role");
    assert.equal(ok(await rousso.db.rpc("get_my_chat_access"), "Rousso access").data.isMentor, true);
    assert.equal(ok(await otherAdmin.db.rpc("get_my_chat_access"), "other admin access").data.isMentor, false);
    const memberAccess = ok(await first.db.rpc("get_my_chat_access"), "free member access").data;
    assert.equal(memberAccess.available, true);
    assert.equal(memberAccess.mentor.studentId, rousso.studentId);
    assert.ok((await anonymous.rpc("send_chat_message", { p_body: "Anonymous forged message", p_client_message_id: randomUUID() })).error);
    assert.ok((await otherAdmin.db.rpc("configure_chat_mentor", { p_student_id: otherAdmin.studentId })).error);
    const configRead = await otherAdmin.db.from("chat_mentor_config").select("*");
    assert.ok(configRead.error || configRead.data?.length === 0, "routing configuration is service-only");
    assert.ok((await otherAdmin.db.from("chat_mentor_config").upsert({ singleton: true, mentor_student_id: otherAdmin.studentId, enabled: true })).error);

    const send = async (user: User, body: string, options: { id?: string; threadId?: string; internal?: boolean } = {}) => {
      const result = ok(await user.db.rpc("send_chat_message", { p_body: body, p_client_message_id: options.id ?? randomUUID(), p_thread_id: options.threadId ?? null, p_is_internal: options.internal ?? false }), "send chat message");
      assert.ok(result.data?.threadId && result.data?.message?.id, "send returns committed canonical message");
      if (!state.threadIds.includes(result.data.threadId)) state.threadIds.push(result.data.threadId);
      return result.data as { threadId: string; message: Row };
    };

    // A free profile can send directly, without paid access or onboarding data.
    const retryId = randomUUID();
    await send(first, "Eerste vraag van een gratis lid", { id: retryId }); // Commit succeeds; pretend its response was lost.
    const retried = await send(first, "Eerste vraag van een gratis lid", { id: retryId });
    const threadId = retried.threadId;
    const committed = ok(await service.from("conversation_messages").select("*").eq("thread_id", threadId).eq("client_message_id", retryId), "inspect idempotent commit").data!;
    assert.equal(committed.length, 1);
    assert.equal(retried.message.id, committed[0].id);
    assert.ok((await first.db.rpc("send_chat_message", { p_body: "Aangepaste inhoud onder hetzelfde ID", p_client_message_id: retryId, p_thread_id: threadId })).error, "conflicting retry must be rejected");
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => send(second, `Gelijktijdige eerste vraag ${index}`)));
    assert.equal(new Set(concurrent.map((result) => result.threadId)).size, 1);
    assert.equal((ok(await service.from("conversation_threads").select("id", { count: "exact" }).eq("student_id", second.studentId).eq("source_type", "mentor_chat").is("source_id", null), "one canonical thread")).count, 1);
    for (let index = 8; index < 30; index++) await send(second, `Verificatie verzendlimiet ${index}`, { threadId: concurrent[0].threadId });
    assert.ok((await second.db.rpc("send_chat_message", { p_body: "Over de verzendlimiet", p_client_message_id: randomUUID(), p_thread_id: concurrent[0].threadId })).error, "a burst beyond the per-thread quota is rejected");
    const thread = ok(await service.from("conversation_threads").select("*").eq("id", threadId).single(), "canonical thread").data!;
    assert.equal(thread.assigned_to_student_id, rousso.studentId);
    assert.equal(thread.unread_for_mentor_count, 1);
    console.log("PASS: free members send immediately; concurrent first sends share one thread; lost-response retries return one canonical message and reject conflicting payloads.");

    const eventRows = ok(await service.from("notification_events").select("*").eq("target_table", "conversation_threads").eq("target_id", threadId), "routed notifications").data!;
    assert.equal(eventRows.length, 1, "retry creates no duplicate notification");
    const recipients = ok(await service.from("notification_recipients").select("student_id").in("event_id", eventRows.map((row) => row.id)), "inspect only mentor recipient").data!;
    assert.deepEqual(recipients.map((row) => row.student_id), [rousso.studentId]);
    // Historical over-delivery does not grant current privacy access.
    ok(await service.from("notification_recipients").insert({ event_id: eventRows[0].id, student_id: otherAdmin.studentId }), "seed stale admin recipient");
    for (const user of [second, otherAdmin]) {
      for (const [table, key, value] of [["conversation_threads", "id", threadId], ["conversation_messages", "thread_id", threadId], ["conversation_events", "thread_id", threadId], ["conversation_participants", "thread_id", threadId], ["notification_events", "target_id", threadId], ["notification_recipients", "event_id", eventRows[0].id]] as const) {
        assert.deepEqual(ok(await user.db.from(table).select("*").eq(key, value), `${table} privacy`).data, [], `${table} hidden from ${user === otherAdmin ? "other admin" : "other member"}`);
      }
      const shell = ok(await user.db.rpc("get_my_notification_shell"), "notification shell privacy").data;
      assert.equal(JSON.stringify(shell).includes("Eerste vraag"), false);
      assert.equal(shell.unreadCount, 0);
      assert.ok((await user.db.rpc("mark_chat_read", { p_thread_id: threadId, p_seen_seq: 1 })).error);
      assert.ok((await user.db.rpc("update_chat_thread", { p_thread_id: threadId, p_status: "closed" })).error);
      assert.ok((await user.db.rpc("send_chat_message", { p_body: "Forged reply", p_client_message_id: randomUUID(), p_thread_id: threadId })).error);
    }
    for (const [table, key] of [["conversation_threads", "id"], ["conversation_messages", "thread_id"], ["conversation_events", "thread_id"]] as const) {
      const result = await anonymous.from(table).select("*").eq(key, threadId);
      assert.ok(result.error || result.data?.length === 0, `anonymous ${table} reads denied`);
    }
    for (const user of [first, otherAdmin]) assert.ok((await user.db.rpc("get_mentor_inbox")).error, "inbox access requires configured mentor identity");
    assert.ok((await otherAdmin.db.rpc("get_chat_read_state", { p_thread_id: threadId })).error);
    assert.ok((await first.db.rpc("send_chat_message", { p_body: "Forged student private note", p_client_message_id: randomUUID(), p_thread_id: threadId, p_is_internal: true })).error);
    assert.ok((ok(await rousso.db.rpc("get_my_notification_shell"), "Rousso notification shell").data.unreadCount) >= 1);
    assert.equal(ok(await rousso.db.from("conversation_messages").select("id").eq("thread_id", threadId), "Rousso message visibility").data!.length, 1);
    for (const db of [anonymous, first.db, second.db, otherAdmin.db, rousso.db]) {
      assert.ok((await db.from("conversation_messages").insert({ thread_id: threadId, sender_student_id: first.studentId, sender_role: "mentor", body: "Forged PostgREST author", is_internal: false, client_message_id: randomUUID(), status: "read", created_at: "2000-01-01T00:00:00Z" })).error, "direct message writes rejected");
      const changed = await db.from("conversation_threads").update({ assigned_to_student_id: otherAdmin.studentId, unread_for_mentor_count: 0 }).eq("id", threadId).select("id");
      assert.ok(changed.error || changed.data?.length === 0, "direct routing/counter changes rejected");
    }
    assert.equal(ok(await service.from("conversation_threads").select("assigned_to_student_id").eq("id", threadId).single(), "routing unchanged after forgery").data!.assigned_to_student_id, rousso.studentId);
    assert.ok((await otherAdmin.db.from("notification_events").insert({ type: "mentor_new_message", target_table: "conversation_threads", target_id: threadId, title: "Forged event", body: "Private contents" })).error);
    const recipientForgery = await otherAdmin.db.from("notification_recipients").update({ student_id: otherAdmin.studentId }).eq("event_id", eventRows[0].id).eq("student_id", rousso.studentId).select("id");
    assert.ok(recipientForgery.error || recipientForgery.data?.length === 0);
    console.log("PASS: only Rousso receives questions; another admin, another student and anonymous requests cannot read or mutate chat data; stale recipients and shell previews stay private; forged PostgREST writes fail.");

    const realtime = new Map<User, Array<{ table: string; record: Row }>>();
    const subscribed = await Promise.all([first, rousso, otherAdmin].map(async (user) => {
      const session = ok(await user.db.auth.getSession(), "realtime auth session").data.session;
      assert.ok(session);
      await user.db.realtime.setAuth(session.access_token);
      const received: Array<{ table: string; record: Row }> = [];
      realtime.set(user, received);
      let channel = user.db.channel(`chat-privacy-${randomUUID()}`);
      for (const [table, filter] of [["conversation_messages", `thread_id=eq.${threadId}`], ["conversation_threads", `id=eq.${threadId}`], ["notification_recipients", `student_id=eq.${rousso.studentId}`]] as const) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, (payload) => received.push({ table, record: payload.new as Row }));
      }
      await new Promise<void>((resolve, reject) => {
        let joined = false;
        let postgresReady = false;
        const timer = setTimeout(() => reject(new Error(`Local Realtime subscription timed out (joined=${joined}, postgresReady=${postgresReady}).`)), 30_000);
        const ready = () => {
          if (joined && postgresReady) { clearTimeout(timer); resolve(); }
        };
        // SUBSCRIBED confirms the socket, not the replication listener. A fresh
        // stack can otherwise miss writes made immediately after the join.
        // https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting
        channel.on("system", {}, (payload) => {
          if (payload.extension !== "postgres_changes") return;
          if (payload.status === "ok") { postgresReady = true; ready(); }
          if (payload.status === "error") { clearTimeout(timer); reject(new Error("Local Realtime PostgreSQL listener failed.")); }
        });
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") { joined = true; ready(); }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(new Error(`Local Realtime subscription failed: ${status}`)); }
        });
      });
      return { user, channel };
    }));
    try {
      const marker = await send(first, "Realtime privacycontrole", { threadId });
      const privateMarker = await send(rousso, "Realtime privénotitie", { threadId, internal: true });
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const mentor = realtime.get(rousso)!;
        const student = realtime.get(first)!;
        if (mentor.some((event) => event.table === "conversation_messages" && event.record.id === marker.message.id)
          && mentor.some((event) => event.table === "conversation_messages" && event.record.id === privateMarker.message.id)
          && mentor.some((event) => event.table === "conversation_threads")
          && mentor.some((event) => event.table === "notification_recipients")
          && student.some((event) => event.table === "conversation_messages" && event.record.id === marker.message.id)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      // Give an unauthorized subscriber the same delivery window as the recipients.
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      for (const id of [marker.message.id, privateMarker.message.id]) assert.ok(realtime.get(rousso)!.some((event) => event.table === "conversation_messages" && event.record.id === id), `Rousso receives authorized ${id === marker.message.id ? "public" : "private"} realtime message; observed tables=${JSON.stringify([...realtime.entries()].map(([user, events]) => ({ role: user === rousso ? "mentor" : user === first ? "student" : "other-admin", tables: events.map((event) => event.table) })))}`);
      assert.ok(realtime.get(rousso)!.some((event) => event.table === "notification_recipients"), "Rousso receives own realtime notification");
      assert.ok(realtime.get(first)!.some((event) => event.record.id === marker.message.id), "student receives public realtime message");
      assert.equal(realtime.get(first)!.some((event) => event.record.id === privateMarker.message.id), false, "internal notes never reach student realtime");
      assert.deepEqual(realtime.get(otherAdmin), [], "another admin receives no thread/message/recipient realtime payload");
      console.log("PASS: real Realtime subscriptions deliver public messages to participants and private notes only to Rousso; another admin receives no chat or recipient payload.");
    } finally {
      await Promise.all(subscribed.map(({ user, channel }) => user.db.removeChannel(channel)));
    }

    const beforeNote = ok(await service.from("conversation_threads").select("last_message_at,last_public_message_seq,unread_for_student_count,unread_for_mentor_count,status").eq("id", threadId).single(), "before note").data;
    const beforeNotifications = ok(await service.from("notification_events").select("id", { count: "exact" }).eq("target_id", threadId), "before note notification count").count;
    const note = await send(rousso, "Privé notitie, nooit zichtbaar voor het lid", { threadId, internal: true });
    assert.equal(note.message.public_seq, null);
    assert.deepEqual(ok(await service.from("conversation_threads").select("last_message_at,last_public_message_seq,unread_for_student_count,unread_for_mentor_count,status").eq("id", threadId).single(), "after note").data, beforeNote);
    assert.equal(ok(await service.from("notification_events").select("id", { count: "exact" }).eq("target_id", threadId), "after note notifications").count, beforeNotifications);
    assert.deepEqual(ok(await first.db.from("conversation_messages").select("id").eq("id", note.message.id), "internal note privacy").data, []);
    const reply = await send(rousso, "Antwoord van Rousso", { threadId });
    await Promise.all([
      first.db.rpc("mark_chat_read", { p_thread_id: threadId, p_seen_seq: reply.message.public_seq }).then((result) => ok(result, "read seen reply")),
      send(rousso, "Nieuw antwoord tijdens het lezen", { threadId }),
    ]);
    const raced = ok(await service.from("conversation_threads").select("unread_for_student_count,last_public_message_seq").eq("id", threadId).single(), "read/send race result").data!;
    assert.equal(raced.unread_for_student_count, 1, "seen cursor never clears a later message");
    ok(await first.db.rpc("mark_chat_read", { p_thread_id: threadId, p_seen_seq: raced.last_public_message_seq }), "mark known newest read");
    // A malicious future cursor must not cause later messages to be auto-read.
    await first.db.rpc("mark_chat_read", { p_thread_id: threadId, p_seen_seq: raced.last_public_message_seq + 1_000_000 });
    await send(rousso, "Bericht na een ongeldige toekomstige leescursor", { threadId });
    assert.equal(ok(await service.from("conversation_threads").select("unread_for_student_count").eq("id", threadId).single(), "future read cursor safety").data!.unread_for_student_count, 1);
    console.log("PASS: internal notes do not create student activity or notifications; read cursors preserve unread replies during concurrent sends and reject future-cursor abuse.");

    // Exercise the exact newest-first public-sequence pagination used by the app.
    for (let start = 0; start < 300; start += 10) {
      // Synthetic history spans time in production. Age only this fixture's rows
      // between batches, so the test respects the real per-minute send quota.
      ok(await service.from("conversation_messages").update({ created_at: "2026-01-01T00:00:00Z" }).eq("thread_id", threadId).eq("sender_student_id", first.studentId), "age synthetic history outside quota window");
      await Promise.all(Array.from({ length: 10 }, (_, offset) => send(first, `Geschiedenis ${String(start + offset).padStart(3, "0")}`, { threadId })));
    }
    const expected = ok(await service.from("conversation_messages").select("id,public_seq").eq("thread_id", threadId).eq("is_internal", false).is("deleted_at", null).order("public_seq", { ascending: false }), "full expected history").data!;
    const history: Row[] = [];
    let cursor: number | null = null;
    do {
      let query = first.db.from("conversation_messages").select("id,public_seq").eq("thread_id", threadId).eq("is_internal", false).is("deleted_at", null).order("public_seq", { ascending: false }).limit(51);
      if (cursor !== null) query = query.lt("public_seq", cursor);
      const page = ok(await query, "newest pagination").data!;
      const visible = page.slice(0, 50);
      history.push(...visible);
      cursor = page.length > 50 ? visible.at(-1)!.public_seq : null;
    } while (cursor !== null);
    assert.deepEqual(history.map((row) => row.id), expected.map((row) => row.id));
    assert.equal(new Set(history.map((row) => row.id)).size, history.length);
    assert.ok(history.length >= 300);
    assert.equal(history[0].public_seq, expected[0].public_seq, "initial page includes latest message");
    const recovered = ok(await first.db.from("conversation_messages").select("id,public_seq").eq("thread_id", threadId).gt("public_seq", history[49].public_seq).order("public_seq", { ascending: true }), "reconnect gap recovery").data!;
    assert.deepEqual(recovered.map((row) => row.id), history.slice(0, 49).reverse().map((row) => row.id));
    console.log("PASS: 300+ public messages page from newest to oldest without gaps/duplicates; sequence-based reconnect recovery returns every missed message.");

    ok(await service.from("chat_mentor_config").update({ enabled: false }).eq("singleton", true), "revoke configured mentor");
    for (const user of [first, rousso, otherAdmin]) {
      assert.equal(ok(await user.db.rpc("get_my_chat_access"), "revoked access").data.available, false);
      assert.deepEqual(ok(await user.db.from("conversation_threads").select("id").eq("id", threadId), "revoked thread visibility").data, []);
      assert.deepEqual(ok(await user.db.from("conversation_messages").select("id").eq("thread_id", threadId), "revoked message visibility").data, []);
      assert.deepEqual(ok(await user.db.from("notification_events").select("id").eq("target_id", threadId), "revoked notifications").data, []);
      assert.ok((await user.db.rpc("send_chat_message", { p_body: "After revocation", p_client_message_id: randomUUID(), p_thread_id: threadId })).error);
      assert.ok((await user.db.rpc("mark_chat_read", { p_thread_id: threadId, p_seen_seq: 1 })).error);
    }
    ok(await configure(), "restore synthetic Rousso for browser fixtures");
    console.log("PASS: disabling mentor routing immediately closes existing chat reads, writes, read actions and notification contents.");

    if (process.argv.includes("--keep")) {
      writeFileSync(fixtureFile, JSON.stringify(state), { mode: 0o600 });
      console.log(`Synthetic browser fixtures saved to ${fixtureFile}; use --cleanup after browser verification.`);
    } else {
      await clean(state);
    }
  } catch (error) {
    await clean(state).catch((cleanupError) => {
      writeFileSync(fixtureFile, JSON.stringify(state), { mode: 0o600 });
      console.error(`Local fixture cleanup requires attention; recovery state saved to ${fixtureFile}:`, cleanupError instanceof Error ? cleanupError.message : "unknown cleanup error");
    });
    throw error;
  } finally {
    await Promise.all(users.map((user) => user.db.removeAllChannels()));
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
