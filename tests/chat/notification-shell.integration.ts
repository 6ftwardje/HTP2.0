/** Read-only regression for the optimized notification shell using existing local fixtures.
 * LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx tests/chat/notification-shell.integration.ts
 * Creates no accounts, rotates no routing and changes no notification state.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, any>;
function ok<T extends { error: unknown }>(result: T, label: string): T {
  assert.equal(result.error, null, `${label}: ${JSON.stringify(result.error)}`);
  return result;
}

async function visibleRows(db: SupabaseClient, studentId: string) {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = ok(await db.from("notification_recipients")
      .select("id,created_at,read_at,event:notification_events!inner(id,type,title,body,href)")
      .eq("student_id", studentId).is("archived_at", null)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + 999), "independent RLS notification rows").data!;
    result.push(...page);
    if (page.length < 1000) return result;
  }
}

async function main() {
  const envPath = process.env.LOCAL_SUPABASE_ENV_FILE;
  if (!envPath) throw new Error("LOCAL_SUPABASE_ENV_FILE is required.");
  const env = Object.fromEntries([...readFileSync(envPath, "utf8").matchAll(/^([A-Z_]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]));
  if (!env.API_URL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.API_URL).hostname)) throw new Error("Local Supabase required; refusing remote fixture access.");
  const fixtures = JSON.parse(readFileSync(process.env.LOCAL_CHAT_FIXTURE_FILE ?? "/tmp/htp-chat-fixtures.json", "utf8")) as { users: Array<{ email: string; password: string; studentId: string }> };
  assert.ok(fixtures.users.length >= 4, "expected free A, free B, Rousso and unrelated admin fixtures");
  const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const anonymous = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  assert.ok((await anonymous.rpc("get_my_notification_shell")).error, "anonymous shell execution is denied");

  for (const [index, fixture] of fixtures.users.entries()) {
    const label = ["free-A", "free-B", "Rousso", "other-admin"][index] ?? `free-extra-${index}`;
    const db = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    ok(await db.auth.signInWithPassword({ email: fixture.email, password: fixture.password }), "authenticate existing fixture");
    // If the active browser changes read state, retry the comparison against a
    // stable before/after RLS snapshot instead of reporting a false mismatch.
    let matched = false;
    let visible: Row[] = [];
    for (let attempt = 0; attempt < 3 && !matched; attempt++) {
      const before = await visibleRows(db, fixture.studentId);
      const shell = ok(await db.rpc("get_my_notification_shell"), "optimized notification shell").data;
      const after = await visibleRows(db, fixture.studentId);
      if (JSON.stringify(before) !== JSON.stringify(after)) continue;
      assert.equal(shell.studentId, fixture.studentId, "definer RPC cannot return another identity");
      assert.equal(shell.unreadCount, before.filter((row) => row.read_at === null && Date.parse(row.created_at) >= Date.now() - 30 * 86400000).length, `${label} shell count matches independent RLS`);
      const expectedPreview = before.slice(0, 5).map((row) => ({ id: row.id, created_at: row.created_at, read_at: row.read_at, event: { type: row.event.type, title: row.event.title, body: row.event.body, href: row.event.href } }));
      assert.deepEqual(shell.notifications, expectedPreview, `${label} shell preview matches independent RLS ordering and contents`);
      assert.ok(shell.notifications.length <= 5);
      if (index === 0 || index === 1) assert.equal(before.some((row) => row.event.type === "mentor_new_message"), false, "students never receive mentor inbox notifications");
      if (index === 3) {
        const stale = ok(await service.from("notification_recipients").select("id,event:notification_events!inner(type)").eq("student_id", fixture.studentId), "service-only stale-delivery oracle").data as unknown as Row[];
        const staleIds = new Set(stale.filter((row) => row.event.type === "mentor_new_message").map((row) => row.id));
        assert.ok(staleIds.size > 0, "fixture includes historical over-delivery to unrelated admin");
        assert.equal(before.some((row) => staleIds.has(row.id)), false, "stale unrelated-admin recipients remain hidden");
      }
      visible = before;
      matched = true;
    }
    assert.equal(matched, true, "notification state must settle for an independent snapshot comparison");
    const timings: number[] = [];
    for (let sample = 0; sample < 5; sample++) {
      const started = performance.now();
      ok(await db.rpc("get_my_notification_shell"), "timed optimized shell");
      timings.push(performance.now() - started);
    }
    const maximum = Math.max(...timings);
    assert.ok(maximum < 250, `${label} warm shell exceeds 250ms: ${maximum.toFixed(1)}ms`);
    console.log(`PASS: ${label} own identity, count and latest five match independent RLS; visible=${visible.length}; warm shell max=${maximum.toFixed(1)}ms.`);
  }
  console.log("PASS: optimized SECURITY DEFINER shell preserves participant privacy, stale-delivery filtering, exact counts and preview bounds for all four authenticated roles; anonymous access denied.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
