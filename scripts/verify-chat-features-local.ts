/** Real local Auth/Postgres/Storage verification for the extended chat.
 * LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx scripts/verify-chat-features-local.ts
 * --keep retains synthetic browser fixtures in a private file; --cleanup removes them.
 * Refuses remote endpoints and never prints account passwords, cookies or keys.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { storeAvatar, AVATAR_BUCKET } from "../lib/avatars/lifecycle";

type Row = Record<string, any>;
type Fixture = { userId: string; studentId: string; name: string; email: string; password: string; cookie: string; avatarPath?: string };
type Actor = Fixture & { db: SupabaseClient };
type State = { users: Fixture[]; previousConfig: Row | null; threadIds: string[] };
const fixtureFile = process.env.LOCAL_CHAT_FEATURE_FIXTURE_FILE ?? "/tmp/htp-chat-feature-fixtures.json";
function ok<T extends { error: unknown }>(result: T, label: string): T {
  assert.equal(result.error, null, `${label}: ${JSON.stringify(result.error)}`); return result;
}
async function main() {
  const envFile = process.env.LOCAL_SUPABASE_ENV_FILE;
  assert.ok(envFile, "Set LOCAL_SUPABASE_ENV_FILE to a local Supabase status -o env file.");
  const env = Object.fromEntries([...readFileSync(envFile, "utf8").matchAll(/^([A-Z_]+)="([^"\r\n]*)"$/gm)].map((m) => [m[1], m[2]]));
  assert.ok(env.API_URL && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.API_URL).hostname), "Local Supabase required; refusing remote integration writes.");
  assert.ok(env.ANON_KEY && env.SERVICE_ROLE_KEY, "Local Supabase keys required.");
  const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymous = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  async function cleanup(state: State) {
    const ids = state.users.map((u) => u.studentId);
    const threads = ids.length ? ok(await service.from("conversation_threads").select("id").in("student_id", ids), "find own fixture threads").data ?? [] : [];
    const threadIds = [...new Set([...state.threadIds, ...threads.map((row) => row.id)])];
    const attachments = ids.length ? ok(await service.from("conversation_attachments").select("id,object_path").in("uploader_student_id", ids), "find own screenshot fixtures").data ?? [] : [];
    if (attachments.length) {
      ok(await service.storage.from("mentor-chat-attachments").remove(attachments.map((row) => row.object_path)), "remove own screenshot files");
      ok(await service.from("conversation_attachments").delete().in("id", attachments.map((row) => row.id)), "remove own screenshot metadata");
    }
    if (threadIds.length) {
      ok(await service.from("notification_events").delete().eq("target_table", "conversation_threads").in("target_id", threadIds), "clean own fixture notifications");
      ok(await service.from("conversation_threads").delete().in("id", threadIds), "clean own fixture threads");
    }
    if (state.previousConfig) ok(await service.from("chat_mentor_config").upsert(state.previousConfig), "restore prior local config");
    else ok(await service.from("chat_mentor_config").delete().eq("singleton", true), "restore prior missing config");
    const paths = state.users.flatMap((u) => u.avatarPath ? [u.avatarPath] : []);
    if (paths.length) {
      ok(await service.from("student_avatars").delete().in("student_id", ids), "remove own avatar references");
      ok(await service.storage.from(AVATAR_BUCKET).remove(paths), "remove own private avatar files");
      ok(await service.from("avatar_objects").delete().in("object_path", paths), "remove own avatar metadata");
    }
    if (ids.length) {
      ok(await service.from("chat_principals").delete().in("student_id", ids), "remove own chat principals");
      ok(await service.from("students").delete().in("id", ids), "remove own student profiles");
    }
    for (const user of state.users) ok(await service.auth.admin.deleteUser(user.userId), "remove own Auth identities");
  }
  if (process.argv.includes("--cleanup")) {
    await cleanup(JSON.parse(readFileSync(fixtureFile, "utf8")) as State); unlinkSync(fixtureFile);
    console.log("PASS: synthetic chat-feature accounts, conversations, presence and avatars removed."); return;
  }
  const previousConfig = ok(await service.from("chat_mentor_config").select("*").maybeSingle(), "snapshot local routing").data;
  const existing = ok(await service.from("conversation_threads").select("id", { count: "exact", head: true }).eq("source_type", "mentor_chat"), "check isolated chat DB").count;
  assert.equal(existing, 0, "Use an isolated local database without existing mentor chats; routing is not rotated around unrelated local conversations.");
  const state: State = { users: [], previousConfig, threadIds: [] };
  const actors: Actor[] = [];
  const save = () => writeFileSync(fixtureFile, JSON.stringify(state), { mode: 0o600 });
  try {
    for (const [index, name] of ["Student Noor", "Student Sam", "Mentor Rousso", "Mentor Elena", "Beheerder Alex"].entries()) {
      const email = `chat-features-${randomUUID()}@example.invalid`, password = randomUUID();
      const created = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }), "create local fixture account").data.user!;
      const fixture: Fixture = { userId: created.id, studentId: randomUUID(), name, email, password, cookie: "" };
      state.users.push(fixture); save();
      ok(await service.from("students").insert({ id: fixture.studentId, auth_user_id: fixture.userId, email, name, access_level: index === 4 ? 3 : 1 }), "create real fixture profile");
      if (index === 3 || index === 4) ok(await service.from("user_roles").insert({ student_id: fixture.studentId, role: index === 3 ? "mentor" : "admin" }), "assign explicit staff role");
      const jar = new Map<string, string>();
      const db = createServerClient(env.API_URL, env.ANON_KEY, { cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies: Array<{ name: string; value: string }>) => cookies.forEach(({ name, value }) => jar.set(name, value)),
      } });
      ok(await db.auth.signInWithPassword({ email, password }), "authenticate fixture");
      fixture.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
      actors.push({ ...fixture, db }); save();
    }
    const [student, otherStudent, defaultMentor, secondMentor, admin] = actors;
    ok(await service.rpc("configure_chat_mentor", { p_student_id: defaultMentor.studentId }), "configure default mentor");
    for (const [index, actor] of [student, defaultMentor].entries()) {
      const path = `${actor.userId}/${randomUUID()}.webp`;
      state.users.find((u) => u.studentId === actor.studentId)!.avatarPath = path; save();
      const bytes = await sharp({ create: { width: 256, height: 256, channels: 3, background: index === 0 ? "#9f6342" : "#446a85" } }).webp().toBuffer();
      await storeAvatar(service, actor, bytes, path); actor.avatarPath = path;
    }
    for (const rpc of ["get_chat_mentors", "get_chat_profiles", "open_chat_thread", "chat_presence_heartbeat", "list_chat_presence", "chat_presence_leave"]) {
      const params = rpc === "get_chat_profiles" || rpc === "list_chat_presence" ? { p_student_ids: [student.studentId] } : rpc === "open_chat_thread" ? { p_mentor_student_id: defaultMentor.studentId } : rpc === "chat_presence_heartbeat" || rpc === "chat_presence_leave" ? { p_session_id: randomUUID() } : {};
      assert.ok((await anonymous.rpc(rpc, params)).error, `anonymous ${rpc} denied`);
    }
    const mentors = ok(await student.db.rpc("get_chat_mentors"), "real mentor directory").data as Row[];
    assert.deepEqual(new Set(mentors.map((m) => m.studentId)), new Set([defaultMentor.studentId, secondMentor.studentId]));
    assert.equal(mentors.find((m) => m.studentId === defaultMentor.studentId)?.avatarPath, defaultMentor.avatarPath);
    assert.equal(mentors.find((m) => m.studentId === secondMentor.studentId)?.avatarPath, null);
    assert.ok(mentors.every((m) => m.role === "mentor" && m.threadId === null));
    assert.equal(ok(await admin.db.rpc("get_my_chat_access"), "admin does not become mentor").data.isMentor, false);
    assert.equal(ok(await secondMentor.db.rpc("get_my_chat_access"), "explicit mentor role access").data.isMentor, true);
    console.log("PASS: authenticated directory uses real roles, names, stored private avatar paths and a fallback for the mentor without a photo; unrelated admin is not a mentor.");

    const opened = await Promise.all(Array.from({ length: 5 }, () => student.db.rpc("open_chat_thread", { p_mentor_student_id: defaultMentor.studentId })));
    const firstThread = ok(opened[0], "open default mentor").data.threadId as string;
    assert.ok(opened.every((r) => !r.error && r.data.threadId === firstThread), "parallel opens deduplicate per student and mentor");
    state.threadIds.push(firstThread); save();
    const secondThread = ok(await student.db.rpc("open_chat_thread", { p_mentor_student_id: secondMentor.studentId }), "open second mentor").data.threadId as string;
    state.threadIds.push(secondThread); save(); assert.notEqual(firstThread, secondThread);
    assert.equal(ok(await student.db.rpc("open_chat_thread", { p_mentor_student_id: defaultMentor.studentId }), "reopen existing mentor").data.threadId, firstThread);
    assert.ok((await student.db.rpc("open_chat_thread", { p_mentor_student_id: otherStudent.studentId })).error);
    assert.ok((await student.db.rpc("open_chat_thread", { p_mentor_student_id: admin.studentId })).error);
    const send = async (actor: Actor, threadId: string, body: string, internal = false) => ok(await actor.db.rpc("send_chat_message", { p_body: body, p_client_message_id: randomUUID(), p_thread_id: threadId, p_is_internal: internal }), "send assigned conversation message").data;
    await send(student, firstThread, "Vraag voor Rousso"); await send(defaultMentor, firstThread, "Antwoord van Rousso");
    await send(student, secondThread, "Vraag voor Elena"); await send(secondMentor, secondThread, "Antwoord van Elena");
    await send(secondMentor, secondThread, "Interne notitie Elena", true);
    assert.deepEqual(ok(await student.db.from("conversation_messages").select("body").eq("thread_id", firstThread).order("public_seq"), "first mentor history").data!.map((m) => m.body), ["Vraag voor Rousso", "Antwoord van Rousso"]);
    assert.deepEqual(ok(await student.db.from("conversation_messages").select("body").eq("thread_id", secondThread).order("public_seq"), "second mentor history").data!.map((m) => m.body), ["Vraag voor Elena", "Antwoord van Elena"]);
    for (const [actor, threadId] of [[otherStudent, firstThread], [admin, firstThread], [defaultMentor, secondThread], [secondMentor, firstThread]] as const) {
      assert.deepEqual(ok(await actor.db.from("conversation_messages").select("id").eq("thread_id", threadId), "cross-conversation privacy").data, []);
      assert.ok((await actor.db.rpc("send_chat_message", { p_body: "Unauthorized", p_client_message_id: randomUUID(), p_thread_id: threadId })).error);
    }
    const updated = ok(await student.db.rpc("get_chat_mentors"), "mentor history directory").data as Row[];
    assert.equal(updated.find((m) => m.studentId === defaultMentor.studentId)?.threadId, firstThread);
    assert.equal(updated.find((m) => m.studentId === secondMentor.studentId)?.threadId, secondThread);
    console.log("PASS: repeated/concurrent mentor selection reuses two isolated histories, messages/replies/internal notes stay private and unrelated mentors, admins and students cannot forge access.");

    const profile = ok(await defaultMentor.db.rpc("get_chat_profiles", { p_student_ids: [student.studentId] }), "mentor opens actual student profile").data as Row[];
    assert.equal(profile.length, 1); assert.equal(profile[0].displayName, student.name); assert.equal(profile[0].avatarPath, student.avatarPath); assert.equal(profile[0].role, "student");
    assert.deepEqual(Object.keys(profile[0]).sort(), ["avatarPath", "displayName", "role", "studentId"].sort(), "profile projection excludes email, intake and billing fields");
    assert.deepEqual(ok(await otherStudent.db.rpc("get_chat_profiles", { p_student_ids: [student.studentId] }), "unrelated student profile denial").data, []);
    assert.equal(ok(await student.db.rpc("get_chat_profiles", { p_student_ids: [secondMentor.studentId] }), "student mentor profile").data[0].displayName, secondMentor.name);
    ok(await student.db.storage.from(AVATAR_BUCKET).download(defaultMentor.avatarPath!), "student reads authorized real mentor avatar");
    ok(await defaultMentor.db.storage.from(AVATAR_BUCKET).download(student.avatarPath!), "mentor reads authorized student avatar");
    assert.ok((await otherStudent.db.storage.from(AVATAR_BUCKET).download(student.avatarPath!)).error, "unrelated student cannot download private photo");
    console.log("PASS: clickable-profile data matches actual account/Storage records with a minimal authorized projection and private avatar access.");

    const sessions = [randomUUID(), randomUUID()];
    const online = async (actor: Actor, ids: string[]) => ok(await actor.db.rpc("list_chat_presence", { p_student_ids: ids }), "read server-time presence").data as Row[];
    ok(await student.db.rpc("chat_presence_heartbeat", { p_session_id: sessions[0] }), "first tab heartbeat");
    ok(await student.db.rpc("chat_presence_heartbeat", { p_session_id: sessions[1] }), "second tab heartbeat");
    assert.equal((await online(defaultMentor, [student.studentId]))[0]?.student_id, student.studentId);
    assert.deepEqual(await online(otherStudent, [student.studentId]), [], "online status hidden from unrelated students");
    assert.ok((await student.db.from("chat_presence_sessions").select("*")).error, "presence rows are not publicly queryable");
    ok(await student.db.rpc("chat_presence_leave", { p_session_id: sessions[0] }), "first tab leaves");
    assert.equal((await online(defaultMentor, [student.studentId])).length, 1, "other active tab preserves online state");
    ok(await student.db.rpc("chat_presence_leave", { p_session_id: sessions[1] }), "last tab leaves");
    assert.deepEqual(await online(defaultMentor, [student.studentId]), [], "last tab leaves offline immediately");
    ok(await secondMentor.db.rpc("chat_presence_heartbeat", { p_session_id: randomUUID() }), "mentor online heartbeat");
    assert.equal((await online(student, [secondMentor.studentId]))[0]?.student_id, secondMentor.studentId);
    ok(await service.from("chat_presence_sessions").update({ last_seen_at: new Date(Date.now() - 90_000).toISOString() }).eq("student_id", secondMentor.studentId), "simulate expired disconnected session");
    assert.deepEqual(await online(student, [secondMentor.studentId]), [], "server TTL expires disconnected mentor without a clean leave");
    console.log("PASS: real authenticated presence updates online dynamically, filters unauthorized readers, handles multiple tabs and expires disconnected sessions using server timestamps.");
    save();
    if (process.argv.includes("--keep")) console.log(`PASS: synthetic browser fixtures retained privately at ${fixtureFile}; run --cleanup after browser checks.`);
    else { await cleanup(state); unlinkSync(fixtureFile); }
  } catch (error) {
    try { await cleanup(state); unlinkSync(fixtureFile); } catch { console.error("Fixture cleanup requires --cleanup with the private fixture file."); }
    throw error;
  } finally { await Promise.all(actors.map((actor) => actor.db.removeAllChannels())); }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
