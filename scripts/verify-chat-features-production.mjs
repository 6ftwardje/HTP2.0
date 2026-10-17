/** Explicitly authorized production acceptance with temporary synthetic accounts only.
 * HTP_PRODUCTION_ENV_FILE=/private/production.env \
 * HTP_CHAT_PRODUCTION_VERIFICATION=hettradeplatform.be \
 * node scripts/verify-chat-features-production.mjs --execute
 * --cleanup replays targeted recovery cleanup from the private state file.
 * Never changes default mentor routing, sends to existing members or prints credentials.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import sharp from "sharp";

const EXPECTED_PROJECT = "swohtycdqbydqrtjzwwf";
const BASE = "https://hettradeplatform.be";
const stateFile = process.env.HTP_CHAT_PRODUCTION_STATE_FILE ?? "/tmp/htp-chat-production-verification.json";
const output = "output/playwright";
function environment(file) {
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^['"]|['"]$/g, "")]];
  }));
}
function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.code ?? result.error?.message ?? "unexpected error"}`);
  return result;
}
function ownThread(state, row) {
  return state.users.some((user) => user.kind === "student" && user.studentId === row.student_id)
    && state.users.some((user) => user.kind === "mentor" && user.studentId === row.assigned_to_student_id);
}
async function main() {
  assert.equal(process.env.HTP_CHAT_PRODUCTION_VERIFICATION, "hettradeplatform.be", "Production verification requires explicit target authorization.");
  assert.ok(process.argv.includes("--execute") || process.argv.includes("--cleanup"), "Choose --execute or --cleanup after deployment is confirmed.");
  assert.ok(process.env.HTP_PRODUCTION_ENV_FILE, "HTP_PRODUCTION_ENV_FILE must point to verified server credentials.");
  const env = environment(process.env.HTP_PRODUCTION_ENV_FILE);
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin, `https://${EXPECTED_PROJECT}.supabase.co`, "Unexpected Supabase project; production writes refused.");
  assert.ok(env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY, "Verified public and service keys required.");
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymous = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const optional = async (query, label) => {
    const result = await query;
    if (["42P01", "PGRST205"].includes(result.error?.code)) return { data: [], error: null };
    return ok(result, label);
  };
  async function cleanup(state) {
    assert.equal(state.project, EXPECTED_PROJECT); assert.equal(state.base, BASE);
    assert.match(state.runId, /^[0-9a-f-]{36}$/i);
    const ids = state.users.map((user) => user.studentId);
    const mentorIds = state.users.filter((user) => user.kind === "mentor").map((user) => user.studentId);
    for (const user of state.users) {
      const account = await service.auth.admin.getUserById(user.userId);
      if (!account.error) assert.equal(account.data.user?.email, `chat-production-${state.runId}-${user.index}@example.invalid`, "Recovery identity must match the exact synthetic run.");
      else assert.equal(account.error.status, 404, "Unexpected Auth recovery lookup failure.");
      const profile = ok(await service.from("students").select("auth_user_id").eq("id", user.studentId).maybeSingle(), "validate owned recovery profile").data;
      if (profile) assert.equal(profile.auth_user_id, user.userId, "Recovery refuses another account's student profile.");
    }
    const mentorThreads = mentorIds.length ? ok(await service.from("conversation_threads").select("id,student_id,assigned_to_student_id").in("assigned_to_student_id", mentorIds), "check temporary mentors for external interactions").data ?? [] : [];
    assert.ok(mentorThreads.every((row) => ownThread(state, row)), "A real member contacted a temporary mentor; retain recovery state and review instead of changing that conversation.");
    const threads = ids.length ? ok(await service.from("conversation_threads").select("id,student_id,assigned_to_student_id").in("student_id", ids), "discover own production test threads").data ?? [] : [];
    assert.ok(threads.every((row) => ownThread(state, row)), "Unexpected non-synthetic conversation; cleanup requires review.");
    const threadIds = threads.map((row) => row.id);
    const attachments = ids.length ? ok(await service.from("conversation_attachments").select("id,object_path").in("uploader_student_id", ids), "find own uploaded screenshots").data ?? [] : [];
    if (attachments.length) {
      ok(await service.storage.from("mentor-chat-attachments").remove(attachments.map((row) => row.object_path)), "remove own screenshot objects");
      ok(await service.from("conversation_attachments").delete().in("id", attachments.map((row) => row.id)), "remove own screenshot records");
    }
    if (threadIds.length) {
      ok(await service.from("chat_email_outbox").delete().in("thread_id", threadIds), "remove own chat email outbox");
      ok(await service.from("notification_events").delete().eq("target_table", "conversation_threads").in("target_id", threadIds), "remove own notification events and recipients");
      ok(await service.from("conversation_threads").delete().in("id", threadIds), "remove own production test conversations");
    }
    const avatarPaths = state.users.flatMap((user) => user.avatarPath ? [user.avatarPath] : []);
    if (avatarPaths.length) {
      ok(await service.from("student_avatars").delete().in("student_id", ids), "remove own avatar references");
      ok(await service.storage.from("profile-avatars").remove(avatarPaths), "remove own private avatar objects");
      ok(await service.from("avatar_objects").delete().in("object_path", avatarPaths), "remove own avatar metadata");
    }
    if (ids.length) {
      ok(await service.from("chat_presence_sessions").delete().in("student_id", ids), "remove own presence leases");
      ok(await service.from("chat_email_preferences").delete().in("student_id", ids), "remove own chat email preferences");
      ok(await service.from("chat_principals").delete().in("student_id", ids), "remove own chat identities");
      ok(await service.from("user_roles").delete().in("student_id", ids), "remove temporary mentor roles");
    }
    // Optional e-mail infrastructure may have captured signup events. Remove only
    // rows belonging to these exact synthetic Auth IDs and contact identities.
    const authIds = state.users.map((user) => user.userId);
    const identityKeys = [];
    for (const user of state.users) {
      const identity = await service.rpc("email_identity_key", { p_email: user.email });
      if (["PGRST202", "42883"].includes(identity.error?.code)) continue;
      ok(identity, "derive only this synthetic optional email identity");
      if (typeof identity.data === "string") identityKeys.push(identity.data);
    }
    const contacts = authIds.length ? (await optional(service.from("email_contacts").select("id,identity_key").in("auth_user_id", authIds), "find own optional email contacts")).data ?? [] : [];
    identityKeys.push(...contacts.map((row) => row.identity_key));
    if (contacts.length) {
      const contactIds = contacts.map((row) => row.id);
      await optional(service.from("email_messages").delete().in("contact_id", contactIds), "remove own optional email messages");
      await optional(service.from("email_enrollments").delete().in("contact_id", contactIds), "remove own optional email enrollments");
      await optional(service.from("email_consent_events").delete().in("contact_id", contactIds), "remove own optional email consent records");
      await optional(service.from("email_suppressions").delete().in("identity_key", contacts.map((row) => row.identity_key)), "remove own optional email suppressions");
      await optional(service.from("email_contacts").delete().in("id", contactIds), "remove own optional email contacts");
    }
    if (authIds.length) await optional(service.from("email_auth_events").delete().in("auth_user_id", authIds), "remove own optional signup events");
    if (ids.length) ok(await service.from("students").delete().in("id", ids), "remove own production test student profiles");
    for (const user of state.users) {
      const result = await service.auth.admin.deleteUser(user.userId);
      if (result.error?.status !== 404) ok(result, "remove own temporary Auth account");
    }
    // Account deletion can intentionally create a hashed email tombstone. These
    // exact throwaway identities must also be removed after the Auth trigger ran.
    if (identityKeys.length) {
      const remainingContacts = (await optional(service.from("email_contacts").select("id").in("identity_key", identityKeys), "find own post-delete optional contacts")).data ?? [];
      if (remainingContacts.length) {
        const remaining = remainingContacts.map((row) => row.id);
        await optional(service.from("email_messages").delete().in("contact_id", remaining), "remove own post-delete optional messages");
        await optional(service.from("email_enrollments").delete().in("contact_id", remaining), "remove own post-delete optional enrollments");
        await optional(service.from("email_consent_events").delete().in("contact_id", remaining), "remove own post-delete optional consent");
        await optional(service.from("email_contacts").delete().in("id", remaining), "remove own post-delete optional contacts");
      }
      await optional(service.from("email_suppressions").delete().in("identity_key", identityKeys), "remove own account-deletion tombstones");
    }
    if (ids.length) {
      assert.equal(ok(await service.from("students").select("id", { count: "exact", head: true }).in("id", ids), "confirm fixture profiles removed").count, 0);
      assert.equal(ok(await service.from("conversation_threads").select("id", { count: "exact", head: true }).in("student_id", ids), "confirm fixture conversations removed").count, 0);
    }
    unlinkSync(stateFile);
    console.log("CLEANUP PASS: temporary production accounts, roles, conversations, notifications, queues, avatars, screenshots and presence removed.");
  }
  if (process.argv.includes("--cleanup")) { await cleanup(JSON.parse(readFileSync(stateFile, "utf8"))); return; }
  assert.equal(existsSync(stateFile), false, "Existing recovery state must be cleaned before another production run.");
  const config = ok(await service.from("chat_mentor_config").select("mentor_student_id,enabled").single(), "read production chat routing without modifying it").data;
  assert.equal(config.enabled, true, "Production chat must already be enabled.");
  const runId = randomUUID();
  const state = { project: EXPECTED_PROJECT, base: BASE, runId, users: [] };
  const save = () => writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
  writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600, flag: "wx" });
  const actors = [], contexts = [], runtimeErrors = [];
  let browser;
  let failure;
  const results = [];
  const pass = (message) => { results.push(message); console.log(`PASS: ${message}`); };
  mkdirSync(output, { recursive: true });
  async function browserSession(actor, viewport = { width: 1440, height: 1000 }) {
    const context = await browser.newContext({ viewport, baseURL: BASE }); contexts.push(context);
    await context.addCookies(actor.cookie.split("; ").filter(Boolean).map((item) => {
      const separator = item.indexOf("=");
      return { name: item.slice(0, separator), value: item.slice(separator + 1), domain: new URL(BASE).hostname, path: "/", httpOnly: false, secure: true, sameSite: "Lax" };
    }));
    const page = await context.newPage(); page.on("pageerror", (error) => runtimeErrors.push(error.message));
    return { page, context };
  }
  const text = (page, value) => page.getByText(value, { exact: true }).first().waitFor({ timeout: 35000 });
  async function hydrated(page, selector, handler) {
    await page.waitForFunction(({ selector, handler }) => {
      const element = document.querySelector(selector);
      return element && Object.keys(element).some((key) => key.startsWith("__reactProps$") && typeof element[key]?.[handler] === "function");
    }, { selector, handler });
  }
  async function choose(page, mentor) {
    assert.ok(state.users.some((user) => user.kind === "mentor" && user.studentId === mentor.studentId), "Only synthetic mentors may be selected by this test.");
    await page.getByRole("navigation", { name: "Kies je mentor" }).getByRole("link", { name: new RegExp(mentor.name) }).click();
    await page.waitForURL(`**/mentor?mentor=${mentor.studentId}`);
    await page.waitForFunction((id) => document.querySelector('nav[aria-label="Kies je mentor"] a[aria-current="page"]')?.getAttribute("href")?.endsWith(id), mentor.studentId);
  }
  async function profile(page, actor, role) {
    await page.bringToFront();
    const button = page.getByRole("button", { name: `Profiel van ${actor.name} bekijken`, exact: true }).first();
    await hydrated(page, `button[aria-label="Profiel van ${actor.name} bekijken"]`, "onClick");
    await button.click(); const dialog = page.getByRole("dialog", { name: "Gebruikersprofiel" });
    await dialog.getByRole("heading", { name: actor.name, exact: true }).waitFor();
    await dialog.getByText(role, { exact: true }).waitFor();
    assert.equal(await dialog.getByText(/@example.invalid/).count(), 0);
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    assert.ok(await button.evaluate((element) => element === document.activeElement), "Profile Escape restores the trigger focus.");
  }
  try {
    for (const [index, kind] of ["student", "student", "mentor", "mentor"].entries()) {
      const email = `chat-production-${runId}-${index}@example.invalid`, password = randomUUID();
      const created = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }), "create a temporary synthetic Auth account").data.user;
      assert.ok(created);
      const fixture = { index, kind, userId: created.id, studentId: randomUUID(), email, password, cookie: "", name: `Tijdelijke controle ${kind === "mentor" ? "mentor" : "student"} ${index % 2 === 0 ? "A" : "B"} ${runId.slice(0, 6)}` };
      state.users.push(fixture); save();
      ok(await service.from("students").insert({ id: fixture.studentId, auth_user_id: fixture.userId, email, name: fixture.name, access_level: 1 }), "create own synthetic student identity");
      ok(await service.from("chat_email_preferences").insert({ student_id: fixture.studentId, enabled: false }), "disable emails for this synthetic account before any sends");
      const jar = new Map();
      const db = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
      } });
      ok(await db.auth.signInWithPassword({ email, password }), "authenticate temporary account");
      fixture.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
      actors.push({ ...fixture, db }); save();
    }
    const [student, unrelated, firstMentor, secondMentor] = actors;
    for (const [index, actor] of [student, firstMentor].entries()) {
      const avatarPath = `${actor.userId}/${randomUUID()}.webp`;
      state.users.find((user) => user.userId === actor.userId).avatarPath = avatarPath; actor.avatarPath = avatarPath; save();
      const bytes = await sharp({ create: { width: 256, height: 256, channels: 3, background: index === 0 ? "#9f6342" : "#446a85" } }).webp().toBuffer();
      ok(await service.from("avatar_objects").insert({ object_path: avatarPath, student_id: actor.studentId }), "register only this test avatar");
      ok(await service.storage.from("profile-avatars").upload(avatarPath, bytes, { contentType: "image/webp", upsert: false }), "upload only this processed avatar");
      ok(await service.rpc("commit_student_avatar", { p_auth_uid: actor.userId, p_path: avatarPath }), "commit this account's processed avatar");
    }
    // Publish the two clearly labelled mentor fixtures only immediately before testing.
    ok(await service.from("user_roles").insert([firstMentor, secondMentor].map((actor) => ({ student_id: actor.studentId, role: "mentor" }))), "enable two temporary synthetic mentors");
    const directory = ok(await student.db.rpc("get_chat_mentors"), "read actual authorized mentor directory").data;
    assert.ok([firstMentor, secondMentor].every((actor) => directory.some((mentor) => mentor.studentId === actor.studentId)));
    assert.equal(directory.find((mentor) => mentor.studentId === firstMentor.studentId)?.avatarPath, firstMentor.avatarPath);
    assert.equal(directory.find((mentor) => mentor.studentId === secondMentor.studentId)?.avatarPath, null);
    const open = async (mentor) => {
      assert.ok([firstMentor.studentId, secondMentor.studentId].includes(mentor.studentId));
      const id = ok(await student.db.rpc("open_chat_thread", { p_mentor_student_id: mentor.studentId }), "open only a synthetic mentor conversation").data.threadId;
      const row = ok(await service.from("conversation_threads").select("student_id,assigned_to_student_id").eq("id", id).single(), "verify synthetic recipient before sending").data;
      assert.ok(ownThread(state, row)); return id;
    };
    const firstThread = await open(firstMentor), secondThread = await open(secondMentor);
    assert.notEqual(firstThread, secondThread); assert.equal(await open(firstMentor), firstThread);
    const send = async (actor, threadId, body, internal = false) => {
      const row = ok(await service.from("conversation_threads").select("student_id,assigned_to_student_id").eq("id", threadId).single(), "verify synthetic conversation mutation scope").data;
      assert.ok(ownThread(state, row));
      return ok(await actor.db.rpc("send_chat_message", { p_body: body, p_client_message_id: randomUUID(), p_thread_id: threadId, p_is_internal: internal }), "send between synthetic participants only").data;
    };
    await send(student, firstThread, "Technische controle: vraag voor mentor A");
    await send(firstMentor, firstThread, "Technische controle: antwoord van mentor A");
    await send(student, secondThread, "Technische controle: vraag voor mentor B");
    await send(secondMentor, secondThread, "Technische controle: antwoord van mentor B");
    await send(secondMentor, secondThread, "Technische controle: interne notitie", true);
    for (const [actor, threadId] of [[unrelated, firstThread], [firstMentor, secondThread], [secondMentor, firstThread]]) {
      assert.deepEqual(ok(await actor.db.from("conversation_messages").select("id").eq("thread_id", threadId), "real cross-account RLS check").data, []);
    }
    assert.deepEqual(ok(await unrelated.db.rpc("get_chat_profiles", { p_student_ids: [student.studentId] }), "unrelated student profile denied").data, []);
    assert.ok((await anonymous.rpc("get_chat_profiles", { p_student_ids: [student.studentId] })).error);
    const actualProfile = ok(await firstMentor.db.rpc("get_chat_profiles", { p_student_ids: [student.studentId] }), "mentor reads its actual chat partner").data[0];
    assert.equal(actualProfile.displayName, student.name); assert.equal(actualProfile.avatarPath, student.avatarPath);
    assert.deepEqual(Object.keys(actualProfile).sort(), ["avatarPath", "displayName", "role", "studentId"].sort());
    pass("real production Auth/RPC/RLS: two synthetic mentor histories, minimal actual profiles, stored avatars, role directory and unrelated-account privacy");

    browser = await chromium.launch({ channel: "chrome", headless: true });
    const learner = await browserSession(student), page = learner.page;
    await page.goto(`${BASE}/mentor?mentor=${firstMentor.studentId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("navigation", { name: "Kies je mentor" }).waitFor({ timeout: 60000 });
    await text(page, "Technische controle: antwoord van mentor A");
    assert.equal(await page.getByRole("log").getByText("Technische controle: vraag voor mentor B", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("log").locator('img[src^="/api/avatars/"]').count(), 2);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="log"] img')].every((image) => image.complete && image.naturalWidth > 0));
    await profile(page, firstMentor, "Mentor");
    await page.locator("#mentor-message").fill("Controleconcept voor mentor A");
    await choose(page, secondMentor); await text(page, "Technische controle: antwoord van mentor B");
    assert.equal(await page.locator("#mentor-message").inputValue(), "");
    assert.equal(await page.getByRole("log").getByText("Technische controle: interne notitie", { exact: true }).count(), 0);
    await page.locator("#mentor-message").fill("Controleconcept voor mentor B");
    await choose(page, firstMentor); assert.equal(await page.locator("#mentor-message").inputValue(), "Controleconcept voor mentor A");
    await choose(page, secondMentor); assert.equal(await page.locator("#mentor-message").inputValue(), "Controleconcept voor mentor B");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#mentor-message")?.value === "Controleconcept voor mentor B");
    pass("live student UI: clickable database profile, incoming/outgoing account photos, separate histories and per-mentor drafts surviving switching and reload");

    const mentor = await browserSession(secondMentor), mentorPage = mentor.page;
    await mentorPage.goto(`${BASE}/mentor-inbox?thread=${secondThread}`, { waitUntil: "domcontentloaded" });
    await mentorPage.locator("#mentor-reply").waitFor({ timeout: 60000 });
    await profile(mentorPage, student, "Student");
    const reply = `Technische controle: live antwoord ${runId.slice(0, 6)}`;
    await mentorPage.locator("#mentor-reply").fill(reply);
    await mentorPage.getByRole("button", { name: "Verzenden", exact: true }).click();
    await text(mentorPage, reply); await text(page, reply);
    await page.bringToFront();
    await page.getByRole("navigation", { name: "Kies je mentor" }).getByRole("link", { name: new RegExp(secondMentor.name) }).getByRole("img", { name: "Online", exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: `Profiel van ${secondMentor.name} bekijken`, exact: true }).first().click();
    await page.getByRole("dialog").getByText("Online", { exact: true }).waitFor({ timeout: 25000 });
    await page.keyboard.press("Escape");
    pass("live mentor UI: actual student profile, real browser reply delivered to another session and dynamic online status in mentor menu/profile");

    for (const width of [1440, 768, 390]) {
      const responsive = await browserSession(student, { width, height: width === 390 ? 844 : 1000 });
      await responsive.page.goto(`${BASE}/mentor?mentor=${secondMentor.studentId}`, { waitUntil: "networkidle" });
      await hydrated(responsive.page, "#mentor-message", "onChange");
      await responsive.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await responsive.page.evaluate(() => {
        const send = [...document.querySelectorAll('button[type="submit"]')].find((node) => node.textContent.includes("Verzenden"));
        const box = send?.getBoundingClientRect();
        return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth, box: box?.toJSON(), hit: box && send.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
      });
      assert.ok(layout.scroll <= layout.width && layout.box && layout.box.top >= 0 && layout.box.bottom <= layout.height && layout.hit, `responsive send control at ${width}px`);
      await responsive.page.screenshot({ path: `${output}/chat-production-features-student-${width}.png`, fullPage: false });
      if (width === 390) {
        await profile(responsive.page, secondMentor, "Mentor");
        await responsive.page.getByRole("button", { name: "Dark mode inschakelen" }).click();
        await responsive.page.getByRole("button", { name: `Profiel van ${secondMentor.name} bekijken`, exact: true }).first().click();
        await responsive.page.getByRole("dialog").getByRole("heading", { name: secondMentor.name }).waitFor();
        await responsive.page.screenshot({ path: `${output}/chat-production-features-profile-mobile-dark.png`, fullPage: false });
      }
      await responsive.context.close();
    }
    await mentorPage.screenshot({ path: `${output}/chat-production-features-mentor-1440.png`, fullPage: false });
    pass("production 1440/768/390px: no horizontal overflow, full send controls hit-tested, real mobile profile/dark-mode modal verified");

    const fresh = await browserSession(unrelated), freshPage = fresh.page;
    await freshPage.goto(`${BASE}/mentor?mentor=${secondMentor.studentId}`, { waitUntil: "domcontentloaded" });
    await text(freshPage, "Waar kan ik je mee helpen?"); await hydrated(freshPage, 'input[type="file"]', "onChange");
    const screenshot = await sharp({ create: { width: 800, height: 450, channels: 3, background: "#426b99" } }).png().toBuffer();
    await freshPage.locator('input[type="file"]').setInputFiles({ name: "Technische controle.png", mimeType: "image/png", buffer: screenshot });
    await freshPage.getByRole("list", { name: "Toegevoegde screenshots" }).getByText("Technische controle.webp", { exact: true }).waitFor();
    const firstBody = "Technische controle: eerste bericht met screenshot";
    await freshPage.locator("#mentor-message").fill(firstBody);
    await freshPage.getByRole("button", { name: "Verzenden", exact: true }).click(); await text(freshPage, firstBody);
    const attachment = freshPage.getByRole("link", { name: "Screenshot openen: Technische controle.webp" });
    await attachment.waitFor();
    const download = await freshPage.request.get(await attachment.getAttribute("href")); assert.equal(download.status(), 200);
    assert.match(download.headers()["content-type"], /image\/webp/);
    const screenshotPath = await attachment.getAttribute("href");
    assert.equal((await page.request.get(`${BASE}${screenshotPath}`)).status(), 404, "another student cannot download the real uploaded screenshot");
    await choose(freshPage, firstMentor); await text(freshPage, "Waar kan ik je mee helpen?");
    await freshPage.waitForLoadState("networkidle"); assert.equal(new URL(freshPage.url()).searchParams.get("mentor"), firstMentor.studentId);
    assert.equal(await freshPage.getByRole("log").getByText(firstBody, { exact: true }).count(), 0);
    await choose(freshPage, secondMentor); await text(freshPage, firstBody);
    const createdRows = ok(await service.from("conversation_threads").select("id,student_id,assigned_to_student_id").eq("student_id", unrelated.studentId), "verify first browser message recipient").data;
    assert.ok(createdRows.length === 1 && ownThread(state, createdRows[0]) && createdRows[0].assigned_to_student_id === secondMentor.studentId);
    assert.equal(ok(await service.from("chat_email_outbox").select("id", { count: "exact", head: true }).in("recipient_student_id", state.users.map((user) => user.studentId)), "no email notifications queued for synthetic users").count, 0);
    pass("production first send with real screenshot: correct mentor pair, private authenticated bytes, immediate mentor switching and persisted history");

    await mentor.context.close(); await page.bringToFront();
    await page.getByRole("navigation", { name: "Kies je mentor" }).getByRole("link", { name: new RegExp(secondMentor.name) }).getByRole("img", { name: "Online", exact: true }).waitFor({ state: "hidden", timeout: 85000 });
    pass("production online indicator disappears after the mentor browser leaves or its server lease expires");
    assert.deepEqual(runtimeErrors, [], "No browser runtime errors.");
    assert.deepEqual(ok(await service.from("chat_mentor_config").select("mentor_student_id,enabled").single(), "confirm global routing untouched").data, config);
    pass("no browser runtime errors, no real-member messages and global chat routing unchanged");
  } catch (error) {
    failure = error;
    if (browser) for (const [index, context] of contexts.entries()) {
      const page = context.pages()[0]; if (!page) continue;
      await page.screenshot({ path: `${output}/chat-production-features-failure-${index}.png`, fullPage: false }).catch(() => {});
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => {})));
    if (browser) await browser.close();
    await Promise.all(actors.map((actor) => actor.db.removeAllChannels()));
    try { await cleanup(state); }
    catch (error) { console.error(`Targeted cleanup requires recovery state at ${stateFile}.`); failure ??= error; }
    writeFileSync(`${output}/chat-production-features-verification.txt`, results.map((result) => `PASS: ${result}`).join("\n") + `\n${failure ? "FAILED: inspect the terminal and retained recovery state if present." : "PASS: targeted production fixtures cleaned."}\n`);
  }
  if (failure) throw failure;
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Production acceptance failed."); process.exitCode = 1; });
