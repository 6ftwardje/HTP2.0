/** Local authenticated API/RPC/Storage verification. Never targets a remote DB.
 * LOCAL_SUPABASE_ENV_FILE=/tmp/htp-chat-local.env \
 * CHAT_ATTACHMENT_TEST_BASE_URL=http://localhost:3114 \
 * npx tsx tests/chat/attachments.integration.ts
 * Uses the current mentor fixture without changing configuration; creates and
 * removes its own two free students, conversations, messages and images.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { CHAT_ATTACHMENT_BUCKET, cleanupChatAttachments } from "../../lib/chat-attachments-server";
import type { ChatAttachment } from "../../lib/types";

function ok<T extends { error: unknown }>(result: T, label: string): T {
  assert.equal(result.error, null, `${label}: ${JSON.stringify(result.error)}`); return result;
}
type Actor = { db: SupabaseClient; cookie: () => string; userId: string; studentId: string };
async function main() {
  const envPath = process.env.LOCAL_SUPABASE_ENV_FILE;
  assert.ok(envPath, "LOCAL_SUPABASE_ENV_FILE is required");
  const env = Object.fromEntries([...readFileSync(envPath, "utf8").matchAll(/^([A-Z_]+)="([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
  const base = process.env.CHAT_ATTACHMENT_TEST_BASE_URL ?? "http://localhost:3114";
  for (const url of [env.API_URL, base]) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Local endpoints required; refusing remote integration writes.");
  const origin = process.env.CHAT_ATTACHMENT_TEST_ORIGIN ?? new URL(base).origin;
  const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymous = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  const fixtures = JSON.parse(readFileSync(process.env.CHAT_ATTACHMENT_TEST_FIXTURES ?? "/tmp/htp-chat-fixtures.json", "utf8")) as {
    users: Array<{ userId: string; studentId: string; email: string; password: string }>;
  };
  const config = ok(await service.from("chat_mentor_config").select("mentor_student_id,enabled").single(), "current mentor").data!;
  const mentorFixture = fixtures.users.find((user) => user.studentId === config.mentor_student_id);
  assert.ok(config.enabled && mentorFixture, "Existing local mentor fixture required; configuration is never rotated by this test.");
  const profiles = ok(await service.from("students").select("id,access_level").in("id", fixtures.users.map((u) => u.studentId)), "fixture roles").data!;
  const adminFixture = fixtures.users.find((u) => u.studentId !== config.mentor_student_id && profiles.some((p) => p.id === u.studentId && p.access_level === 3));
  assert.ok(adminFixture, "Unrelated admin fixture required");
  async function actor(credentials: { email: string; password: string; userId: string; studentId: string }): Promise<Actor> {
    const jar = new Map<string, string>();
    const db = createServerClient(env.API_URL, env.ANON_KEY, { cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies: Array<{ name: string; value: string }>) => { for (const cookie of cookies) jar.set(cookie.name, cookie.value); },
    } });
    ok(await db.auth.signInWithPassword({ email: credentials.email, password: credentials.password }), "authenticate actor");
    return { db, cookie: () => [...jar].map(([name, value]) => `${name}=${value}`).join("; "), userId: credentials.userId, studentId: credentials.studentId };
  }
  const created: Array<{ userId: string; studentId: string }> = []; const intents = new Set<string>();
  async function freeActor() {
    const email = `chat-attachment-${randomUUID()}@example.invalid`; const password = randomUUID();
    const user = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }), "create fresh free account").data.user!;
    const fixture = { userId: user.id, studentId: "" }; created.push(fixture);
    const profile = ok(await service.from("students").insert({ email, auth_user_id: user.id, name: "Screenshot fixture", access_level: 1 }).select("id").single(), "create free profile").data!;
    fixture.studentId = profile.id;
    return actor({ email, password, userId: user.id, studentId: profile.id });
  }
  const image = async (color = "#4676ba") => sharp({ create: { width: 1600, height: 900, channels: 3, background: color } }).png().withMetadata().toBuffer();
  async function upload(user: Actor | null, bytes: Buffer, intent: string, threadId?: string, expected = 200, fileName = "BTC chart.png") {
    intents.add(intent);
    const form = new FormData(); form.set("upload_intent", intent); if (threadId) form.set("thread_id", threadId);
    form.set("file", new Blob([new Uint8Array(bytes)]), fileName);
    const response = await fetch(`${base}/api/chat/attachments`, { method: "POST", headers: { Origin: origin, ...(user ? { Cookie: user.cookie() } : {}) }, body: form });
    const data = await response.json(); assert.equal(response.status, expected, `upload: ${JSON.stringify(data)}`);
    return data.attachment as ChatAttachment;
  }
  async function get(user: Actor | null, id: string, expected: number) {
    const response = await fetch(`${base}/api/chat/attachments/${id}`, { headers: user ? { Cookie: user.cookie() } : {} });
    assert.equal(response.status, expected, "authenticated image download");
    assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/, "authorization failures must not be cached either");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    if (expected === 200) {
      assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff"); assert.equal(response.headers.get("content-type"), "image/webp");
      const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
    }
    return response;
  }
  async function remove(user: Actor, id: string, expected: number) {
    const response = await fetch(`${base}/api/chat/attachments/${id}`, { method: "DELETE", headers: { Origin: origin, Cookie: user.cookie() } });
    assert.equal(response.status, expected, "pending removal");
  }
  const wrapper = (user: Actor, body: string, clientId: string, ids: string[], intent: string | null, threadId?: string, internal = false) =>
    user.db.rpc("send_chat_message_with_attachments", { p_body: body, p_client_message_id: clientId, p_thread_id: threadId ?? null,
      p_is_internal: internal, p_attachment_ids: ids, p_upload_intent: intent });
  try {
    const [student, otherStudent, mentor, admin] = await Promise.all([freeActor(), freeActor(), actor(mentorFixture), actor(adminFixture)]);
    const source = await image(); const firstIntent = randomUUID();
    await upload(null, source, randomUUID(), undefined, 401);
    const badOriginForm = new FormData(); badOriginForm.set("file", new Blob([new Uint8Array(source)]), "chart.png");
    assert.equal((await fetch(`${base}/api/chat/attachments`, { method: "POST", headers: { Origin: "https://untrusted.invalid", Cookie: student.cookie() }, body: badOriginForm })).status, 403);
    await upload(student, Buffer.from("<svg><script>alert(1)</script></svg>"), randomUUID(), undefined, 400);
    await upload(student, Buffer.alloc(4 * 1024 * 1024 + 1), randomUUID(), undefined, 413);
    assert.deepEqual(ok(await service.from("conversation_threads").select("id").eq("student_id", student.studentId), "fresh thread absence").data, []);
    const first = await upload(student, source, firstIntent);
    assert.deepEqual(Object.keys(first).sort(), ["fileName", "height", "id", "mediaType", "sizeBytes", "width"].sort());
    assert.equal(first.width, 1600); assert.equal(first.height, 900);
    assert.equal((await upload(student, source, firstIntent)).id, first.id, "lost-response upload retry deduplicates by validated content");
    assert.deepEqual(ok(await service.from("conversation_threads").select("id").eq("student_id", student.studentId), "upload never creates thread").data, []);
    const privateRow = ok(await service.from("conversation_attachments").select("*").eq("id", first.id).single(), "registered private metadata").data!;
    assert.equal(privateRow.state, "ready"); assert.equal(privateRow.message_id, null); assert.equal(privateRow.thread_id, null);
    assert.ok((await student.db.from("conversation_attachments").select("object_path").eq("id", first.id)).error, "storage path is not an authenticated projection");
    assert.ok((await student.db.storage.from(CHAT_ATTACHMENT_BUCKET).download(privateRow.object_path)).error, "owner cannot bypass route with raw Storage download");
    assert.ok((await admin.db.storage.from(CHAT_ATTACHMENT_BUCKET).createSignedUrl(privateRow.object_path, 60)).error, "other admin cannot issue a signed file URL");
    assert.ok((await student.db.storage.from(CHAT_ATTACHMENT_BUCKET).upload(`${student.userId}/${randomUUID()}.webp`, source, { contentType: "image/webp" })).error, "direct upload is denied");
    await get(student, first.id, 200); for (const user of [mentor, otherStudent, admin]) await get(user, first.id, 404); await get(null, first.id, 401);
    console.log("PASS: real free-account upload, bounded validation, metadata stripping, retry deduplication, pending-owner-only downloads and Storage bypass denial.");

    const clientId = randomUUID(); const sent = ok(await wrapper(student, "Mijn eerste chartvraag", clientId, [first.id], firstIntent), "first caption plus screenshot").data;
    const threadId = sent.threadId as string; const messageId = sent.message.id as string;
    assert.equal(sent.message.public_seq, 1); assert.deepEqual(sent.message.attachments, [first]);
    assert.equal(ok(await wrapper(student, "Mijn eerste chartvraag", clientId, [first.id], firstIntent), "canonical retry").data.message.id, messageId);
    for (const attempt of [wrapper(student, "Mijn eerste chartvraag", clientId, [], null),
      wrapper(student, "Mijn eerste chartvraag", clientId, [first.id], randomUUID()),
      student.db.rpc("send_chat_message", { p_body: "Mijn eerste chartvraag", p_client_message_id: clientId }),
      wrapper(student, "Andere inhoud", clientId, [first.id], firstIntent)]) {
      assert.equal((await attempt).error?.code, "22023", "same send intent cannot change attachment or caption payload");
    }
    assert.equal(ok(await service.from("conversation_messages").select("id").eq("thread_id", threadId), "first send exactly once").data!.length, 1);
    for (const user of [student, mentor]) { await get(user, first.id, 200);
      assert.deepEqual(ok(await user.db.rpc("get_chat_message_attachments", { p_message_ids: [messageId] }), "visible batch").data, [{ messageId, attachments: [first] }]); }
    for (const user of [otherStudent, admin]) { await get(user, first.id, 404);
      assert.deepEqual(ok(await user.db.rpc("get_chat_message_attachments", { p_message_ids: [messageId] }), "cross-account batch denial").data, []); }
    assert.ok((await anonymous.rpc("get_chat_message_attachments", { p_message_ids: [messageId] })).error);
    await remove(student, first.id, 404); await get(mentor, first.id, 200);

    const removable = await upload(student, await image("#998877"), randomUUID(), threadId);
    await remove(otherStudent, removable.id, 404); await remove(student, removable.id, 200); await remove(student, removable.id, 200); await get(student, removable.id, 404);
    const beforeNote = ok(await service.from("conversation_threads").select("last_message_at,last_public_message_seq,unread_for_student_count,status").eq("id", threadId).single(), "before image note").data;
    const noteIntent = randomUUID(); const noteImage = await upload(mentor, await image("#9977bb"), noteIntent, threadId);
    const note = ok(await wrapper(mentor, "Interne chartnotitie", randomUUID(), [noteImage.id], noteIntent, threadId, true), "internal note image").data;
    assert.equal(note.message.public_seq, null); await get(mentor, noteImage.id, 200); await get(student, noteImage.id, 404);
    assert.deepEqual(ok(await student.db.rpc("get_chat_message_attachments", { p_message_ids: [note.message.id] }), "internal batch denial").data, []);
    assert.deepEqual(ok(await service.from("conversation_threads").select("last_message_at,last_public_message_seq,unread_for_student_count,status").eq("id", threadId).single(), "after image note").data, beforeNote);
    await upload(mentor, source, randomUUID(), undefined, 403);
    console.log("PASS: atomic first screenshot message, strict retry payload across both send APIs, public participant-only reads, safe pending deletion and internal-note isolation.");

    const otherThread = ok(await otherStudent.db.rpc("send_chat_message", { p_body: "Andere student", p_client_message_id: randomUUID() }), "other student's own thread").data.threadId as string;
    await upload(student, source, randomUUID(), otherThread, 403);
    const theftIntent = randomUUID(); const theft = await upload(student, await image("#eecc55"), theftIntent, threadId);
    const beforeTheft = ok(await service.from("conversation_messages").select("id").eq("thread_id", otherThread), "before stolen attachment attempt").data!.length;
    assert.equal((await wrapper(otherStudent, "Gestolen screenshot", randomUUID(), [theft.id], theftIntent, otherThread)).error?.code, "42501");
    const wrongThreadIntent = randomUUID(); const wrongThread = await upload(mentor, await image("#cc55ee"), wrongThreadIntent, threadId);
    assert.equal((await wrapper(mentor, "Verkeerd gesprek", randomUUID(), [wrongThread.id], wrongThreadIntent, otherThread)).error?.code, "42501");
    assert.equal(ok(await service.from("conversation_messages").select("id").eq("thread_id", otherThread), "failed links roll back message and event").data!.length, beforeTheft);
    const quotaIntent = randomUUID(); const quota: ChatAttachment[] = [];
    for (const color of ["#221133", "#331144", "#441155"]) quota.push(await upload(student, await image(color), quotaIntent, threadId));
    await upload(student, await image("#551166"), quotaIntent, threadId, 429);
    assert.equal((await wrapper(student, "Te veel bestanden", randomUUID(), [...quota.map((a) => a.id), theft.id], quotaIntent)).error?.code, "22023");
    assert.equal((await wrapper(student, "Dubbel bestand", randomUUID(), [quota[0].id, quota[0].id], quotaIntent)).error?.code, "22023");
    assert.equal((await wrapper(student, "   \n", randomUUID(), [quota[0].id], quotaIntent)).error?.code, "22023");
    assert.equal((await wrapper(student, "Verborgen studentnotitie", randomUUID(), [quota[0].id], quotaIntent, threadId, true)).error?.code, "42501");
    assert.ok((await student.db.rpc("_send_chat_message_core", { p_body: "Private entry point", p_client_message_id: randomUUID() })).error, "internal send implementation is not a client API");
    assert.ok((await student.db.rpc("register_chat_attachment", { p_auth_uid: student.userId, p_upload_intent: quotaIntent,
      p_thread_id: threadId, p_object_path: privateRow.object_path, p_content_sha256: privateRow.content_sha256,
      p_file_name: "forged.webp", p_width: 1, p_height: 1, p_size_bytes: 1 })).error, "client cannot register unvalidated files");
    const threeIntent = randomUUID(); const three: ChatAttachment[] = [];
    for (const color of ["#772299", "#8833aa", "#9944bb"]) three.push(await upload(student, await image(color), threeIntent, threadId));
    const threeClient = randomUUID();
    const threeSent = ok(await wrapper(student, "Drie chartbeelden", threeClient, three.map((a) => a.id), threeIntent, threadId), "three screenshots in one message").data;
    assert.deepEqual(threeSent.message.attachments, three, "canonical attachment order follows the first successful send");
    assert.deepEqual(ok(await wrapper(student, "Drie chartbeelden", threeClient, three.map((a) => a.id).reverse(), threeIntent, threadId), "same attachment set in reversed retry order").data.message.attachments, three);
    console.log("PASS: wrong student, wrong thread, internal flags, duplicate IDs, missing caption, forged registration and over-quota uploads are rejected atomically.");

    const testRows = ok(await service.from("conversation_attachments").select("id,state").in("upload_intent", [...intents]), "own cleanup fixtures").data!;
    ok(await service.from("conversation_attachments").update({ created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }).in("id", testRows.map((row) => row.id)), "expire only own test uploads");
    await cleanupChatAttachments(service); await cleanupChatAttachments(service);
    for (const attachment of quota) { await get(student, attachment.id, 404); assert.equal(ok(await service.from("conversation_attachments").select("state").eq("id", attachment.id).single(), "expired cleanup tombstone").data!.state, "deleted"); }
    await get(student, first.id, 200); await get(mentor, noteImage.id, 200);
    const publicParticipant = ok(await service.from("conversation_participants").select("id,chat_principals!inner(student_id)").eq("thread_id", threadId).eq("role", "student"), "student participant").data!.find((row) => row.chat_principals && (row.chat_principals as unknown as { student_id: string }).student_id === student.studentId)!;
    ok(await service.from("conversation_participants").update({ active: false, revoked_at: new Date().toISOString() }).eq("id", publicParticipant.id), "revoke own test participant");
    await get(student, first.id, 404); assert.deepEqual(ok(await student.db.rpc("get_chat_message_attachments", { p_message_ids: [messageId] }), "revoked batch").data, []);
    console.log("PASS: 24-hour orphan cleanup is repeatable, preserves linked/public/internal files, and revoked membership loses byte and metadata access.");
  } finally {
    if (intents.size) {
      const rows = ok(await service.from("conversation_attachments").select("id,object_path").in("upload_intent", [...intents]), "cleanup attachment fixture metadata").data!;
      if (rows.length) { ok(await service.storage.from(CHAT_ATTACHMENT_BUCKET).remove(rows.map((row) => row.object_path)), "cleanup own test files");
        ok(await service.from("conversation_attachments").delete().in("id", rows.map((row) => row.id)), "cleanup own test attachment rows"); }
    }
    const studentIds = created.map((user) => user.studentId).filter(Boolean);
    if (studentIds.length) {
      const threads = ok(await service.from("conversation_threads").select("id").in("student_id", studentIds), "cleanup own thread IDs").data!;
      if (threads.length) { const ids = threads.map((row) => row.id);
        ok(await service.from("notification_events").delete().eq("target_table", "conversation_threads").in("target_id", ids), "cleanup own message notifications");
        ok(await service.from("conversation_threads").delete().in("id", ids), "cleanup own conversations"); }
      ok(await service.from("chat_principals").delete().in("student_id", studentIds), "cleanup own sender principals");
      ok(await service.from("students").delete().in("id", studentIds), "cleanup own free profiles");
    }
    for (const user of created) ok(await service.auth.admin.deleteUser(user.userId), "cleanup own auth accounts");
    assert.deepEqual(ok(await service.from("chat_mentor_config").select("mentor_student_id,enabled").single(), "configuration unchanged").data, config);
    console.log("CLEANUP PASS: existing mentor configuration/browser fixtures preserved; all synthetic attachment accounts/files/conversations removed.");
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
