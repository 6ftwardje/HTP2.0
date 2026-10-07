/** Integration verification against local Supabase only. No remote writes/provider calls.
 * LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx scripts/verify-market-posts-local.ts
 * Add --keep to retain clearly synthetic fixtures for browser verification.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { AVATAR_BUCKET, cleanupAvatars, storeAvatar } from "../lib/avatars/lifecycle";

async function main() {
  const envFile = process.env.LOCAL_SUPABASE_ENV_FILE;
  if (!envFile) throw new Error("Set LOCAL_SUPABASE_ENV_FILE to local supabase status -o env output.");
  const values = Object.fromEntries([...readFileSync(envFile, "utf8").matchAll(/^([A-Z_]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]));
  const url = values.API_URL;
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local Supabase required; refusing remote integration writes.");
  const service = createClient(url, values.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const app = process.env.LOCAL_APP_URL ?? "http://localhost:3107";
  if (!["localhost", "127.0.0.1"].includes(new URL(app).hostname)) throw new Error("Local app required.");
  const fixtureFile = "/tmp/htp-market-fixtures.json";
  async function clean(fixtures: { users: Array<{ studentId: string; userId: string }>; postIds: number[] }) {
    if (fixtures.postIds.length) await service.from("weekly_updates").delete().in("id", fixtures.postIds);
    if (fixtures.users.length) await service.from("students").delete().in("id", fixtures.users.map((user) => user.studentId));
    await cleanupAvatars(service);
    for (const user of fixtures.users) await service.auth.admin.deleteUser(user.userId);
  }
  if (process.argv.includes("--cleanup")) { await clean(JSON.parse(readFileSync(fixtureFile, "utf8"))); console.log("Local synthetic fixtures removed."); return; }
  const users: Array<{ userId: string; studentId: string; db: SupabaseClient; email: string; password: string; cookie: string }> = [];
  const postIds: number[] = [];
  const post = async (overrides: Record<string, unknown> = {}) => {
    const { data, error } = await service.from("weekly_updates").insert({ title: "Synthetische verificatie — marktinzicht", slug: `verification-${randomUUID()}`, type: "market_update", market: "crypto", markets: ["crypto"], week_start_date: "2026-10-05", is_published: true, published_at: "2026-10-07T10:00:00Z", access_tier: "free", ...overrides }).select().single();
    assert.equal(error, null); postIds.push(data.id); return data;
  };
  try {
    for (const [index, level] of [1, 1, 2, 3].entries()) {
      const email = `verification-${randomUUID()}@example.invalid`; const password = randomUUID();
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(error, null); assert.ok(data.user);
      const profile = await service.from("students").insert({ auth_user_id: data.user.id, email, name: index === 3 ? "Verificatie Admin" : `Verificatie Lid ${index + 1}`, access_level: level }).select("id").single();
      assert.equal(profile.error, null);
      const cookies = new Map<string, string>();
      const db = createServerClient(url, values.ANON_KEY, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: (changes: Array<{ name: string; value: string }>) => changes.forEach(({ name, value }) => cookies.set(name, value)) } });
      const login = await db.auth.signInWithPassword({ email, password }); assert.equal(login.error, null);
      users.push({ userId: data.user.id, studentId: profile.data!.id, email, password, db, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") });
    }
    const [first, second, academy, admin] = users;
    const article = await post({ content_kind: "article", mentor_student_id: admin.studentId, intro: "Synthetische testinhoud voor layoutcontrole.", title: "Synthetische verificatie: een lange titel voor de tekst- en chartupdate die volledig leesbaar blijft op ieder scherm", article_html: '<p>Deze synthetische inhoud dient alleen voor lokale verificatie. De productieanalyses worden niet gewijzigd.</p><h2>Inhoud en media</h2><p><strong>Opmaak blijft behouden.</strong> Afbeeldingen worden in de oorspronkelijke volgorde weergegeven.</p><figure><img src="/htp-verification-chart.png" width="1200" height="600" alt="Synthetische testafbeelding, geen marktdata"><figcaption>Synthetische afbeelding voor verificatie</figcaption></figure><p>De inhoud na de afbeelding blijft toegankelijk.</p>' });
    const video = await post({ mentor_student_id: admin.studentId, summary: "Synthetische videotoelichting voor verificatie.", video_provider: "vimeo", video_url: "https://vimeo.com/76979871", title: "Synthetische verificatie van de video-update", video_duration_seconds: 62 });
    const draft = await post({ is_published: false });
    const restricted = await post({ access_tier: "subscription" });
    const anonymous = createClient(url, values.ANON_KEY);
    for (const db of [anonymous, first.db]) {
      for (const id of db === anonymous ? [article.id, draft.id, restricted.id] : [draft.id, restricted.id]) {
        assert.ok((await db.rpc("set_market_post_reaction", { p_post_id: id, p_active: true })).error);
        assert.ok((await db.rpc("market_post_reaction_state", { p_post_id: id })).error);
      }
    }
    for (const user of [academy, admin]) assert.equal((await user.db.rpc("set_market_post_reaction", { p_post_id: restricted.id, p_active: true })).error, null);
    assert.ok((await admin.db.rpc("set_market_post_reaction", { p_post_id: draft.id, p_active: true })).error);
    const set = async (user: typeof first, active: boolean) => {
      const result = await user.db.rpc("set_market_post_reaction", { p_post_id: article.id, p_active: active }); assert.equal(result.error, null); return result.data[0];
    };
    assert.equal((await set(first, true)).total, 1);
    assert.equal((await set(second, true)).total, 2);
    assert.equal((await set(admin, true)).total, 3);
    assert.equal((await set(first, true)).total, 3);
    const simultaneous = await Promise.all(Array.from({ length: 12 }, () => set(first, true)));
    assert.ok(simultaneous.every((result) => result.total === 3 && result.active));
    assert.equal((await set(first, false)).total, 2);
    assert.equal((await set(first, false)).total, 2);
    const reloaded = await first.db.rpc("market_post_reaction_state", { p_post_id: article.id }); assert.equal(reloaded.data[0].total, 2); assert.equal(reloaded.data[0].active, false);
    for (const user of [first, admin]) {
      assert.ok((await user.db.from("market_post_reactions").insert({ post_id: article.id, student_id: academy.studentId })).error);
      await user.db.from("market_post_reactions").delete().eq("post_id", article.id).eq("student_id", second.studentId);
      assert.equal((await second.db.rpc("market_post_reaction_state", { p_post_id: article.id })).data[0].active, true);
      const visible = await user.db.from("market_post_reactions").select("student_id").eq("post_id", article.id);
      assert.ok(visible.data?.every((reaction) => reaction.student_id === user.studentId));
    }
    assert.ok((await first.db.from("students").update({ access_level: 3 }).eq("id", first.studentId)).error);
    assert.ok((await admin.db.from("students").update({ auth_user_id: randomUUID() }).eq("id", second.studentId)).error);
    console.log("PASS: real Postgres reaction uniqueness, retries, concurrency, totals, lifecycle access and RLS; private identities stay hidden.");

    const image = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#8b82bf" } }).jpeg().toBuffer();
    const crop = { x: 100, y: 0, width: 600, height: 600 };
    const requestPhoto = async (user: typeof first, bytes: Buffer, extra: Record<string, string> = {}) => {
      const form = new FormData(); form.set("photo", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "disguised.png"); form.set("crop", JSON.stringify(crop));
      for (const [key, value] of Object.entries(extra)) form.set(key, value);
      return fetch(`${app}/api/account/avatar`, { method: "POST", body: form, headers: { origin: app, cookie: user.cookie } });
    };
    for (const user of [first, admin]) {
      const uploaded = await requestPhoto(user, image, { userId: second.userId, storagePath: `${second.userId}/attacker.webp` });
      const result = await uploaded.json(); assert.equal(uploaded.status, 200, JSON.stringify(result));
      assert.ok(result.objectPath.startsWith(`${user.userId}/`));
      const original = result.objectPath;
      for (const invalid of [Buffer.from("broken"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), Buffer.alloc(5 * 1024 * 1024 + 1)]) {
        assert.ok(!(await requestPhoto(user, invalid)).ok);
        assert.equal((await user.db.from("student_avatars").select("object_path").eq("student_id", user.studentId).single()).data!.object_path, original);
      }
      assert.equal((await user.db.storage.from(AVATAR_BUCKET).upload(`${user.userId}/${randomUUID()}.webp`, image)).error !== null, true);
      assert.ok((await user.db.rpc("commit_student_avatar", { p_auth_uid: second.userId, p_path: original })).error);
      assert.ok((await user.db.from("student_avatars").upsert({ student_id: second.studentId, object_path: original })).error);
      const replaced = await requestPhoto(user, image); const newPath = (await replaced.json()).objectPath; assert.equal(replaced.status, 200);
      assert.notEqual(newPath, original);
      assert.ok((await service.storage.from(AVATAR_BUCKET).download(original)).error);
      const stored = await service.storage.from(AVATAR_BUCKET).download(newPath); assert.equal(stored.error, null);
      const metadata = await sharp(Buffer.from(await stored.data!.arrayBuffer())).metadata(); assert.equal(metadata.width, 512); assert.equal(metadata.height, 512); assert.equal(metadata.exif, undefined);
      const deleted = await fetch(`${app}/api/account/avatar`, { method: "DELETE", headers: { origin: app, cookie: user.cookie } }); assert.equal(deleted.status, 200);
      assert.equal((await user.db.from("student_avatars").select("object_path").eq("student_id", user.studentId).single()).data!.object_path, null);
      assert.ok((await service.storage.from(AVATAR_BUCKET).download(newPath)).error);
    }
    const requests = await Promise.all(Array.from({ length: 4 }, () => requestPhoto(admin, image)));
    assert.ok(requests.every((response) => response.status === 200));
    const current = (await admin.db.from("student_avatars").select("object_path").eq("student_id", admin.studentId).single()).data!.object_path;
    await cleanupAvatars(service);
    assert.equal((await service.storage.from(AVATAR_BUCKET).download(current)).error, null);
    assert.equal((await first.db.rpc("market_post_author", { p_post_id: article.id })).data[0].object_path, current);
    assert.equal((await first.db.rpc("market_post_author", { p_post_id: video.id })).data[0].object_path, current);
    // Failed upload/profile commit preserves old avatar and only removes the new orphan.
    const faultPath = `${admin.userId}/${randomUUID()}.webp`;
    const faultyDb = { from: service.from.bind(service), storage: service.storage, rpc: (name: string, args: unknown) => name === "commit_student_avatar" ? Promise.resolve({ error: { message: "injected profile write failure" } }) : service.rpc(name, args as never) } as unknown as SupabaseClient;
    await assert.rejects(storeAvatar(faultyDb, { userId: admin.userId, studentId: admin.studentId }, await sharp(image).webp().toBuffer(), faultPath));
    assert.equal((await service.storage.from(AVATAR_BUCKET).download(current)).error, null);
    assert.ok((await service.storage.from(AVATAR_BUCKET).download(faultPath)).error);
    // Lost commit response must not delete the successfully committed object.
    const lostPath = `${admin.userId}/${randomUUID()}.webp`;
    const lostResponseDb = { from: service.from.bind(service), storage: service.storage, rpc: async (name: string, args: unknown) => { const response = await service.rpc(name, args as never); return name === "commit_student_avatar" ? { ...response, error: { message: "lost response" } } : response; } } as unknown as SupabaseClient;
    await assert.rejects(storeAvatar(lostResponseDb, { userId: admin.userId, studentId: admin.studentId }, await sharp(image).webp().toBuffer(), lostPath));
    assert.equal((await service.storage.from(AVATAR_BUCKET).download(lostPath)).error, null);
    const untrusted = await fetch(`${app}/api/account/avatar`, { method: "DELETE", headers: { origin: "https://untrusted.invalid", cookie: admin.cookie } }); assert.equal(untrusted.status, 403);
    const unauthenticated = await fetch(`${app}/api/account/avatar`, { method: "DELETE", headers: { origin: app } }); assert.equal(unauthenticated.status, 401);
    assert.ok((await anonymous.storage.from(AVATAR_BUCKET).download(lostPath)).error);
    assert.equal((await first.db.storage.from(AVATAR_BUCKET).download(lostPath)).error, null); // authorized author
    const privatePath = `${second.userId}/${randomUUID()}.webp`;
    await storeAvatar(service, { userId: second.userId, studentId: second.studentId }, await sharp(image).webp().toBuffer(), privatePath);
    assert.ok((await first.db.storage.from(AVATAR_BUCKET).download(privatePath)).error);
    const publisherPost = await post({ content_format: "text", body: "Synthetische publisherverificatie.", mentor_student_id: admin.studentId, created_by_student_id: admin.studentId, published_by_student_id: second.studentId, published_by_display_name: "Verificatie Publisher" });
    const publisher = await first.db.rpc("market_post_author", { p_post_id: publisherPost.id });
    assert.equal(publisher.error, null);
    assert.equal(publisher.data[0].student_id, second.studentId);
    assert.equal(publisher.data[0].name, "Verificatie Publisher");
    assert.equal(publisher.data[0].object_path, privatePath);
    assert.equal((await first.db.storage.from(AVATAR_BUCKET).download(privatePath)).error, null);
    await service.from("weekly_updates").delete().eq("id", publisherPost.id);
    assert.ok((await first.db.storage.from(AVATAR_BUCKET).download(privatePath)).error);
    for (const user of [first, admin]) {
      await user.db.storage.from(AVATAR_BUCKET).remove([privatePath]);
      assert.equal((await service.storage.from(AVATAR_BUCKET).download(privatePath)).error, null);
    }
    const uploadFaultPath = `${admin.userId}/${randomUUID()}.webp`;
    const failedUploadDb = { from: service.from.bind(service), rpc: service.rpc.bind(service), storage: { from: (bucket: string) => { const storage = service.storage.from(bucket); return { upload: async () => ({ error: { message: "injected storage failure" } }), remove: storage.remove.bind(storage) }; } } } as unknown as SupabaseClient;
    await assert.rejects(storeAvatar(failedUploadDb, { userId: admin.userId, studentId: admin.studentId }, image, uploadFaultPath));
    assert.equal((await service.storage.from(AVATAR_BUCKET).download(lostPath)).error, null);
    // A late Storage completion after pending expiry is rediscovered safely.
    const delayedPath = `${admin.userId}/${randomUUID()}.webp`;
    assert.equal((await service.from("avatar_objects").insert({ object_path: delayedPath, student_id: admin.studentId, created_at: "2000-01-01T00:00:00Z" })).error, null);
    await cleanupAvatars(service);
    assert.equal((await service.storage.from(AVATAR_BUCKET).upload(delayedPath, await sharp(image).webp().toBuffer(), { contentType: "image/webp" })).error, null);
    await cleanupAvatars(service);
    assert.ok((await service.storage.from(AVATAR_BUCKET).download(delayedPath)).error);
    assert.equal((await service.storage.from(AVATAR_BUCKET).download(lostPath)).error, null);
    // Deletion races both the RPC and a direct own-row insert.
    const deletionRace = await Promise.all([
      ...Array.from({ length: 12 }, () => second.db.rpc("set_market_post_reaction", { p_post_id: article.id, p_active: true })),
      second.db.from("market_post_reactions").insert({ post_id: video.id, student_id: second.studentId }),
      service.auth.admin.deleteUser(second.userId),
    ]);
    assert.equal(deletionRace.at(-1)?.error, null);
    await cleanupAvatars(service);
    assert.ok((await service.storage.from(AVATAR_BUCKET).download(privatePath)).error);
    assert.equal((await service.from("market_post_reactions").select("*", { count: "exact" }).eq("student_id", second.studentId)).count, 0);
    assert.ok((await second.db.rpc("set_market_post_reaction", { p_post_id: article.id, p_active: true })).error);
    assert.ok((await second.db.from("market_post_reactions").insert({ post_id: video.id, student_id: second.studentId })).error);
    assert.ok((await service.rpc("commit_student_avatar", { p_auth_uid: second.userId, p_path: null })).error);
    console.log("PASS: member/admin upload, replace, delete; invalid sources/CSRF/direct writes rejected; original retained on failure; concurrent/lost-response cleanup keeps active file; late uploads reclaimed; concurrent account deletion removes reactions; private Storage enforced.");
    const cascade = await post(); await first.db.rpc("set_market_post_reaction", { p_post_id: cascade.id, p_active: true });
    await service.from("weekly_updates").delete().eq("id", cascade.id);
    assert.equal((await service.from("market_post_reactions").select("*", { count: "exact" }).eq("post_id", cascade.id)).count, 0);
    console.log("PASS: post deletion cascades reactions.");
    if (process.argv.includes("--keep")) {
      writeFileSync(fixtureFile, JSON.stringify({ users: users.map(({ db, ...user }) => user), postIds, articleSlug: article.slug, videoSlug: video.slug }));
      console.log("Synthetic browser fixtures saved in /tmp; run --cleanup after browser verification.");
    } else await clean({ users, postIds });
  } catch (error) { await clean({ users, postIds }); throw error; }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
