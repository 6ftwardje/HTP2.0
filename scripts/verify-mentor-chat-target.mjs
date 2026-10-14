/** Read-only verification of the designated Rousso account and real user RLS.
 * node scripts/verify-mentor-chat-target.mjs
 * Does not create accounts/messages or change a database/session outside its transaction.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const EXPECTED_PROJECT = "swohtycdqbydqrtjzwwf";
const EXPECTED_MENTOR = "9c42c1e3-26e7-4fea-b4f8-c7c9d405effd";
const localEnv = fs.existsSync(".env.local") ? Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split).trim(), line.slice(split + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
) : {};
const env = { ...localEnv, ...process.env };
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_DB_PASSWORD) throw new Error("Supabase URL and database password are required.");
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname !== `${EXPECTED_PROJECT}.supabase.co` || fs.readFileSync("supabase/.temp/project-ref", "utf8").trim() !== EXPECTED_PROJECT) throw new Error("Unexpected Supabase project; refusing verification.");
const connection = fs.readFileSync("supabase/.temp/pooler-url", "utf8").trim();
const parsed = new URL(connection);
if (!parsed.hostname.endsWith(".supabase.com") || !decodeURIComponent(parsed.username).includes(EXPECTED_PROJECT)) throw new Error("Unexpected database pooler target.");

function read(sql) {
  const result = spawnSync("psql", [connection, "-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql, encoding: "utf8", timeout: 30000,
    env: { ...process.env, PGPASSWORD: env.SUPABASE_DB_PASSWORD,
      PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=20000" },
  });
  if (result.status !== 0) throw new Error(`Read-only verification failed: ${(result.stderr ?? "").replaceAll(env.SUPABASE_DB_PASSWORD, "[redacted]").slice(-500)}`);
  return result.stdout.split("\n").filter((line) => line.startsWith("{"));
}

const actors = JSON.parse(read(`select json_build_object(
  'mentor',(select auth_user_id from public.students where id='${EXPECTED_MENTOR}'),
  'otherAdmin',(select auth_user_id from public.students where access_level=3 and id<>'${EXPECTED_MENTOR}' limit 1),
  'freeStudent',(select s.auth_user_id from public.students s join public.conversation_threads t on t.student_id=s.id
    where s.access_level=1 and t.source_type='mentor_chat' and s.auth_user_id is not null limit 1)
);`)[0]);
const checks = [];
for (const [viewer, authUserId] of Object.entries(actors)) {
  if (!authUserId) continue;
  if (!/^[0-9a-f-]{36}$/i.test(authUserId)) throw new Error("Invalid account identity.");
  const claims = JSON.stringify({ sub: authUserId, role: "authenticated" });
  const result = read(`begin read only;
    select set_config('request.jwt.claims','${claims}',true);
    set local role authenticated;
    select json_build_object('viewer','${viewer}',
      'visibleThreads',(select count(*) from public.conversation_threads where source_type='mentor_chat'),
      'foreignStudentThreads',(select count(*) from public.conversation_threads
        where source_type='mentor_chat' and student_id<>public.legacy_chat_current_student_id()),
      'foreignStudentMessages',(select count(*) from public.conversation_messages m
        join public.conversation_threads t on t.id=m.thread_id
        where t.source_type='mentor_chat' and t.student_id<>public.legacy_chat_current_student_id()),
      'mentorQuestionNotifications',(select count(*) from public.notification_events where type='mentor_new_message')
    ); rollback;`);
  const check = JSON.parse(result.find((line) => line.startsWith('{"viewer"')));
  // Staff can contact Rousso as a member in their own thread; admin status must
  // never let them read another student's conversation or mentor-only delivery.
  if (viewer !== "mentor" && (check.foreignStudentThreads || check.foreignStudentMessages || check.mentorQuestionNotifications)) throw new Error(`Private access remains for ${viewer}.`);
  checks.push(check);
}
const summary = JSON.parse(read(`select json_build_object(
  'mentorConfigured',(select enabled and mentor_student_id='${EXPECTED_MENTOR}'::uuid from public.chat_mentor_config where singleton),
  'threads',(select count(*) from public.conversation_threads),
  'messages',(select count(*) from public.conversation_messages),
  'allThreadsAssignedToRousso',not exists(select 1 from public.conversation_threads
    where source_type='mentor_chat' and assigned_to_student_id is distinct from '${EXPECTED_MENTOR}'::uuid),
  'chatCoreDeployed',to_regprocedure('public.send_chat_message(text,uuid,uuid,boolean)') is not null,
  'chatAttachmentsDeployed',to_regclass('public.conversation_attachments') is not null,
  'chatEmailOutboxDeployed',to_regclass('public.chat_email_outbox') is not null,
  'privacyMigrationRecorded',exists(select 1 from supabase_migrations.schema_migrations where version='20261014005000')
);`)[0]);
if (!summary.mentorConfigured || !summary.allThreadsAssignedToRousso || !summary.privacyMigrationRecorded) throw new Error("Privacy configuration verification failed.");
let operations = null;
if (summary.chatEmailOutboxDeployed) {
  operations = JSON.parse(read(`select json_build_object(
    'queuedOrRetry',(select count(*) from public.chat_email_outbox where status in ('queued','retry')),
    'failedOrNeedsReview',(select count(*) from public.chat_email_outbox where status in ('failed','needs_review')),
    'expiredLeases',(select count(*) from public.chat_email_outbox where status='leased' and lease_until<now()),
    'oldestPendingMinutes',(select round(extract(epoch from now()-min(created_at))/60) from public.chat_email_outbox where status in ('queued','retry','leased'))
  );`)[0]);
}
if (summary.chatAttachmentsDeployed) {
  const privateBucket = JSON.parse(read("select json_build_object('private',exists(select 1 from storage.buckets where id='mentor-chat-attachments' and not public));")[0]);
  if (!privateBucket.private) throw new Error("Chat attachment bucket must be private.");
}
console.log(JSON.stringify({ verified: true, project: EXPECTED_PROJECT, summary, authorizationChecks: checks, operations }, null, 2));
