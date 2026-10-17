/** Read-only HTP2 preflight/postflight. Never creates users, messages or leases.
 * node scripts/verify-chat-features-target.mjs --preflight
 * node scripts/verify-chat-features-target.mjs [--snapshot /private/new-file.json]
 * A snapshot contains aggregate hashes only; production migration preservation
 * should additionally compare rows while holding locks in the same transaction.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

try {
const PROJECT = "swohtycdqbydqrtjzwwf";
const MENTOR = "9c42c1e3-26e7-4fea-b4f8-c7c9d405effd";
const VERSION = "20261017000000";
const args = process.argv.slice(2);
assert.ok(args.every((arg, index) => arg === "--preflight" || arg === "--snapshot" || args[index - 1] === "--snapshot"), "Unknown verification option.");
const preflight = args.includes("--preflight");
const snapshotIndex = args.indexOf("--snapshot");
const snapshotPath = snapshotIndex === -1 ? null : args[snapshotIndex + 1];
if (snapshotIndex !== -1) assert.ok(snapshotPath && path.isAbsolute(snapshotPath), "Snapshot requires an absolute private file path.");
const localEnv = fs.existsSync(".env.local") ? Object.fromEntries(fs.readFileSync(".env.local", "utf8")
  .split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => { const at = line.indexOf("="); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")]; })) : {};
const env = { ...localEnv, ...process.env };
assert.ok(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_DB_PASSWORD, "Supabase URL and database password are required.");
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${PROJECT}.supabase.co`, "Unexpected Supabase API target.");
assert.equal(fs.readFileSync("supabase/.temp/project-ref", "utf8").trim(), PROJECT, "Unexpected linked Supabase target.");
const connection = fs.readFileSync("supabase/.temp/pooler-url", "utf8").trim();
const databaseUrl = new URL(connection);
assert.ok(databaseUrl.hostname.endsWith(".supabase.com") && decodeURIComponent(databaseUrl.username) === `postgres.${PROJECT}`, "Unexpected database pooler target.");

function read(sql) {
  const result = spawnSync("psql", [connection, "-X", "-qAt", "-0", "-v", "ON_ERROR_STOP=1"], {
    input: `begin read only;\n${sql}\nrollback;`, encoding: "utf8", timeout: 30_000,
    env: { ...process.env, PGPASSWORD: env.SUPABASE_DB_PASSWORD, PGCONNECT_TIMEOUT: "10",
      PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=20000 -c lock_timeout=5000" },
  });
  if (result.status !== 0) throw new Error(`Read-only verification failed: ${(result.stderr ?? "").replaceAll(env.SUPABASE_DB_PASSWORD, "[redacted]").slice(-500)}`);
  // json_agg(record) can contain formatting newlines. A NUL record separator
  // preserves each complete JSON value while quiet mode suppresses SQL tags.
  return result.stdout.split("\0").map((value) => value.trim())
    .filter((value) => value.startsWith("{")).map((value) => JSON.parse(value));
}
const summary = read(`select json_build_object('stage','metadata',
  'configuredMentor', (select enabled and mentor_student_id='${MENTOR}'::uuid from public.chat_mentor_config where singleton),
  'configuredMentorLive', exists(select 1 from public.students s join auth.users u on u.id=s.auth_user_id
    where s.id='${MENTOR}' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())),
  'coreInstalled', to_regprocedure('public.send_chat_message(text,uuid,uuid,boolean)') is not null,
  'attachmentsInstalled', to_regclass('public.conversation_attachments') is not null,
  'chatEmailInstalled', to_regclass('public.chat_email_outbox') is not null,
  'optionalCampaignEmail', to_regprocedure('public.email_mentor_unread(uuid,text)') is not null,
  'featuresInstalled', to_regprocedure('public.get_chat_profiles(uuid[])') is not null,
  'migrationRecorded', exists(select 1 from supabase_migrations.schema_migrations where version='${VERSION}'),
  'oldDefaultIndex', to_regclass('public.conversation_threads_default_student_unique') is not null,
  'pairIndex', to_regclass('public.conversation_threads_student_mentor_unique') is not null,
  'duplicatePairs', (select count(*) from (select student_id,assigned_to_student_id from public.conversation_threads
    where source_type='mentor_chat' and source_id is null group by student_id,assigned_to_student_id having count(*)>1) duplicate),
  'mentorRoleCount', (select count(*) from public.user_roles where role='mentor'),
  'threads',(select count(*) from public.conversation_threads),
  'messages',(select count(*) from public.conversation_messages),
  'avatars',(select count(*) from public.student_avatars),
  'chatAttachments',(select count(*) from public.conversation_attachments),
  'migrationColumns',(select json_agg(column_name order by ordinal_position) from information_schema.columns
    where table_schema='supabase_migrations' and table_name='schema_migrations')
);`).find((row) => row.stage === "metadata");
assert.ok(summary.configuredMentor && summary.configuredMentorLive && summary.coreInstalled && summary.attachmentsInstalled && summary.chatEmailInstalled, "Required production chat prerequisites are incomplete.");
assert.equal(summary.duplicatePairs, 0, "Duplicate conversation pairs prevent the additive index migration.");
if (!preflight) assert.ok(summary.featuresInstalled && summary.migrationRecorded && summary.pairIndex && !summary.oldDefaultIndex, "Feature migration is incomplete or unrecorded.");

const preservedTables = ["conversation_threads", "conversation_messages", "chat_principals", "conversation_participants", "conversation_events", "conversation_message_reactions", "conversation_attachments", "notification_events", "notification_recipients", "chat_email_outbox", "student_avatars", "avatar_objects"];
const preservation = read(`select json_build_object('stage','preservation','tables',json_build_object(${preservedTables.map((table) => `
  '${table}',(select json_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'' order by md5(to_jsonb(row_value)::text)),''))) from public.${table} row_value)`).join(",")}));`).find((row) => row.stage === "preservation").tables;
const authorizationChecks = [];
let grants = null;
if (summary.featuresInstalled) {
  grants = read(`select json_build_object('stage','grants',
    'sessionRowsPrivate',not has_table_privilege('authenticated','public.chat_presence_sessions','SELECT'),
    'sessionRls',(select relrowsecurity from pg_class where oid='public.chat_presence_sessions'::regclass),
    'profilesAuthenticated',has_function_privilege('authenticated','public.get_chat_profiles(uuid[])','EXECUTE'),
    'profilesAnonymousDenied',not has_function_privilege('anon','public.get_chat_profiles(uuid[])','EXECUTE'),
    'mentorsAnonymousDenied',not has_function_privilege('anon','public.get_chat_mentors()','EXECUTE'),
    'presenceAnonymousDenied',not has_function_privilege('anon','public.list_chat_presence(uuid[])','EXECUTE'),
    'internalMentorHelperDenied',not has_function_privilege('authenticated','public.is_available_chat_mentor(uuid)','EXECUTE'),
    'presenceNotPublished',not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_presence_sessions'),
    'chatRealtimeTables',(select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
      and tablename in ('conversation_threads','conversation_messages','notification_recipients'))
  );`).find((row) => row.stage === "grants");
  assert.ok(Object.entries(grants).every(([key, value]) => key === "stage" || key === "chatRealtimeTables" || value === true), "Chat feature grants or presence privacy are incorrect.");
  assert.equal(grants.chatRealtimeTables, 3, "An existing chat realtime table is missing from its publication.");
  const actors = read(`select json_build_object('stage','actors','rows',coalesce(json_agg(a),'[]'::json)) from (
    select 'mentor' label,s.id student_id,s.auth_user_id from public.students s where s.id='${MENTOR}'
    union all
    (select 'otherAdmin',s.id,s.auth_user_id from public.students s join auth.users u on u.id=s.auth_user_id
      where s.access_level=3 and s.id<>'${MENTOR}' and not public.is_available_chat_mentor(s.id)
        and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) order by s.created_at limit 1)
    union all
    (select 'freeStudent',s.id,s.auth_user_id from public.students s join auth.users u on u.id=s.auth_user_id
      where s.access_level=1 and not public.is_available_chat_mentor(s.id)
        and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
      order by exists(select 1 from public.conversation_threads t where t.student_id=s.id and t.source_type='mentor_chat') desc,s.created_at limit 1)
  ) a;`).find((row) => row.stage === "actors").rows;
  for (const actor of actors) {
    assert.match(actor.student_id, /^[0-9a-f-]{36}$/i);
    assert.match(actor.auth_user_id, /^[0-9a-f-]{36}$/i);
    // Compute independently from raw service-visible rows; the authenticated
    // checks below must produce exactly this scope without directory access.
    const expected = read(`with available as materialized (
      select s.id from public.students s join auth.users u on u.id=s.auth_user_id cross join public.chat_mentor_config cfg
      where cfg.singleton and cfg.enabled and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
        and (cfg.mentor_student_id=s.id or exists(select 1 from public.user_roles r where r.student_id=s.id and r.role='mentor'))
    ), my_threads as materialized (
      select t.id,cp.role,t.student_id,t.assigned_to_student_id from public.conversation_threads t
      join public.conversation_participants cp on cp.thread_id=t.id and cp.active and cp.revoked_at is null
      join public.chat_principals p on p.id=cp.principal_id and p.kind='human' and p.student_id='${actor.student_id}'
      where t.source_type='mentor_chat' and t.student_id<>t.assigned_to_student_id and t.assigned_to_student_id in(select id from available)
        and ((cp.role='student' and t.student_id=p.student_id) or(cp.role='mentor' and t.assigned_to_student_id=p.student_id))
    ), allowed_profiles as materialized (
      select s.id,coalesce(nullif(btrim(s.name),''),'Platformlid') display_name,a.object_path,
        case when s.access_level=3 or exists(select 1 from public.user_roles r where r.student_id=s.id and r.role='admin') then 'admin'
          when s.id in(select id from available) or exists(select 1 from public.user_roles r where r.student_id=s.id and r.role='mentor') then 'mentor' else 'student' end role
      from public.students s join auth.users u on u.id=s.auth_user_id left join public.student_avatars a on a.student_id=s.id
      where u.deleted_at is null and(u.banned_until is null or u.banned_until<=now()) and (
        s.id='${actor.student_id}' or s.id in(select id from available) or exists(select 1 from my_threads t where
          t.student_id=s.id or t.assigned_to_student_id=s.id or exists(select 1 from public.conversation_messages m where m.thread_id=t.id
            and m.sender_student_id=s.id and m.deleted_at is null and(not m.is_internal or t.role='mentor'))))
    )
    select json_build_object('stage','expected','isMentor',exists(select 1 from available where id='${actor.student_id}'),
      'threads',coalesce((select json_agg(id order by id) from my_threads),'[]'::json),
      'messages',coalesce((select json_agg(m.id order by m.id) from public.conversation_messages m join my_threads t on t.id=m.thread_id
        where m.deleted_at is null and(not m.is_internal or t.role='mentor')),'[]'::json),
      'mentors',coalesce((select json_agg(a.id order by a.id) from available a where a.id<>'${actor.student_id}' and not exists(
        select 1 from public.conversation_threads t where t.student_id='${actor.student_id}' and t.assigned_to_student_id=a.id
          and t.source_type='mentor_chat' and t.source_id is null and not exists(select 1 from my_threads mine where mine.id=t.id and mine.role='student'))),'[]'::json),
      'profileIds',(select json_agg(id order by id) from public.students),
      'profiles',coalesce((select json_agg(json_build_object('studentId',id,'displayName',display_name,'role',role,'avatarPath',object_path) order by id) from allowed_profiles),'[]'::json)
    );`).find((row) => row.stage === "expected");
    // Batch all existing account IDs in groups of 200, retaining the RPC bound.
    const candidates = expected.profileIds ?? [];
    const claims = JSON.stringify({ sub: actor.auth_user_id, role: "authenticated" });
    const profileCalls = [];
    const presenceCalls = [];
    for (let at = 0; at < candidates.length; at += 200) {
      const array = `array[${candidates.slice(at, at + 200).map((id) => `'${id}'::uuid`).join(",")}]::uuid[]`;
      profileCalls.push(`public.get_chat_profiles(${array})`);
      presenceCalls.push(`(select coalesce(json_agg(p),'[]'::json) from public.list_chat_presence(${array}) p)`);
    }
    const actual = read(`select set_config('request.jwt.claims','${claims}',true);
      set local role authenticated;
      select json_build_object('stage','actual','access',public.get_my_chat_access(),
        'threads',coalesce((select json_agg(id order by id) from public.conversation_threads where source_type='mentor_chat'),'[]'::json),
        'messages',coalesce((select json_agg(m.id order by m.id) from public.conversation_messages m join public.conversation_threads t on t.id=m.thread_id where t.source_type='mentor_chat'),'[]'::json),
        'mentors',public.get_chat_mentors(),
        'profileBatches',json_build_array(${profileCalls.join(",")}),
        'presenceBatches',json_build_array(${presenceCalls.join(",")})
      );`).find((row) => row.stage === "actual");
    assert.equal(actual.access.isMentor, expected.isMentor, `${actor.label}: role does not match trusted capability.`);
    assert.deepEqual(actual.threads, expected.threads, `${actor.label}: thread RLS scope changed.`);
    assert.deepEqual(actual.messages, expected.messages, `${actor.label}: message/private-note RLS scope changed.`);
    assert.deepEqual(actual.mentors.map((mentor) => mentor.studentId).sort(), expected.mentors, `${actor.label}: mentor directory scope differs.`);
    const profiles = actual.profileBatches.flat().sort((a, b) => a.studentId.localeCompare(b.studentId));
    assert.deepEqual(profiles, expected.profiles, `${actor.label}: profile fields or scope differ from permitted identities.`);
    const permittedIds = new Set(profiles.map((profile) => profile.studentId));
    const online = actual.presenceBatches.flat();
    for (const lease of online) {
      assert.ok(permittedIds.has(lease.student_id), `${actor.label}: presence leaks an unauthorized profile.`);
      const age = Date.parse(lease.server_now) - Date.parse(lease.last_seen_at);
      assert.ok(age >= 0 && age < 65_000, `${actor.label}: presence returned an expired or future lease.`);
    }
    authorizationChecks.push({ viewer: actor.label, visibleThreads: actual.threads.length, visibleMessages: actual.messages.length,
      availableMentors: actual.mentors.length, allowedProfiles: profiles.length, visibleOnlineUsers: online.length });
  }
}
const result = { verified: true, mode: preflight ? "preflight" : "postflight", project: PROJECT, summary, grants, authorizationChecks, preservation };
if (snapshotPath) {
  fs.writeFileSync(snapshotPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  fs.chmodSync(snapshotPath, 0o600);
}
console.log(JSON.stringify(result, null, 2));

} catch (error) {
  // Assertion diagnostics may contain private profiles in actual/expected.
  // Emit only our short, deliberately content-free first line.
  console.error(String(error?.message ?? "Production verification failed.").split("\n")[0]);
  process.exitCode = 1;
}
