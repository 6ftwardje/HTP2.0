/** Isolated, local-only GitHub Actions plumbing for mentor-chat integration.
 * Supabase CLI start/status usage follows https://supabase.com/docs/reference/cli
 * and https://supabase.com/docs/guides/deployment/ci/testing.
 * Never links, pushes, uses repository secrets or prints generated credentials.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = process.env.RUNNER_TEMP;
const workdir = process.env.CHAT_CI_WORKDIR;
const credentialsFile = process.env.LOCAL_SUPABASE_ENV_FILE;
const fixturesFile = process.env.LOCAL_CHAT_FIXTURE_FILE;
const appUrl = process.env.CHAT_CI_APP_URL ?? "http://127.0.0.1:3114";

function privatePath(value, label) {
  assert.ok(temporaryRoot && value, `${label} must be set inside RUNNER_TEMP.`);
  const relative = path.relative(path.resolve(temporaryRoot), path.resolve(value));
  assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `${label} must remain inside RUNNER_TEMP.`);
  return path.resolve(value);
}

function requireIsolatedRunner() {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "This helper operates only in an ephemeral GitHub Actions runner.");
  privatePath(workdir, "CHAT_CI_WORKDIR");
  privatePath(credentialsFile, "LOCAL_SUPABASE_ENV_FILE");
  privatePath(fixturesFile, "LOCAL_CHAT_FIXTURE_FILE");
  assert.equal(existsSync(path.join(workdir, "supabase", ".temp", "project-ref")), false, "Remote project links are forbidden.");
}

function localUrl(value, label, protocols) {
  const url = new URL(value);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && protocols.includes(url.protocol), `${label} must be local.`);
  return url;
}

function parseEnvironment(text) {
  return Object.fromEntries([...text.matchAll(/^([A-Z_]+)="([^"\r\n]*)"$/gm)].map((match) => [match[1], match[2]]));
}

function readCredentials() {
  const env = parseEnvironment(readFileSync(credentialsFile, "utf8"));
  localUrl(env.API_URL, "Supabase API", ["http:", "https:"]);
  localUrl(env.DB_URL, "Postgres", ["postgres:", "postgresql:"]);
  assert.ok(env.ANON_KEY && env.SERVICE_ROLE_KEY, "Generated local credentials are incomplete.");
  return env;
}

function fileInRunner(name) { return path.join(temporaryRoot, name); }

function sanitizedDiagnostics(text) {
  // CLI status/start output includes local keys. Emit only short failure lines,
  // suppress credential labels and redact bearer tokens/connection passwords.
  const migrations = [...text.matchAll(/Applying migration ([a-zA-Z0-9_.-]+\.sql)/g)];
  if (migrations.length) console.error(`Last migration attempted: ${migrations.at(-1)[1]}`);
  for (const line of text.split(/\r?\n/).filter((value) => /(?:^ERROR:|error executing|failed to|insufficient|unhealthy)/i.test(value)).slice(-8)) {
    if (/\b(?:secret|password|anon_key|service_role_key|access.token|api.key)\b/i.test(line)) continue;
    console.error(line.replace(/eyJ[A-Za-z0-9_.-]+/g, "[redacted JWT]")
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted key]")
      .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/g, "$1[redacted]@"));
  }
}

function supabase(args, label) {
  const result = spawnSync("supabase", ["--workdir", workdir, ...args], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 12 * 60 * 1000 });
  if (result.status !== 0) {
    sanitizedDiagnostics(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    throw new Error(`${label} failed; remote fallback and ignored health checks are forbidden.`);
  }
  return result.stdout;
}

function prepare() {
  assert.equal(existsSync(workdir), false, "CI workdir must be fresh; existing databases must never be reset here.");
  mkdirSync(path.join(workdir, "supabase"), { recursive: true, mode: 0o700 });
  let config = readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
  assert.match(config, /^project_id\s*=.*$/m, "Supabase project ID missing.");
  config = config.replace(/^project_id\s*=.*$/m, `project_id = "htp-mentor-chat-ci-${process.env.GITHUB_RUN_ID ?? "test"}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}"`);
  let seedSections = 0;
  config = config.replace(/(\[db\.seed\]\s*\n)([\s\S]*?)(?=\n\[|$)/, (_match, heading, body) => {
    seedSections++;
    assert.match(body, /^enabled\s*=\s*true\s*$/m, "Unexpected seed config; review CI setup instead of silently changing it.");
    return heading + body.replace(/^enabled\s*=\s*true\s*$/m, "enabled = false");
  });
  assert.equal(seedSections, 1, "Expected one optional seed section.");
  writeFileSync(path.join(workdir, "supabase", "config.toml"), config, { mode: 0o600 });
  cpSync(path.join(root, "supabase", "migrations"), path.join(workdir, "supabase", "migrations"), { recursive: true });
}

function start() {
  prepare();
  // Retain Auth, Realtime, PostgREST, Kong, Storage and mailpit. Services unrelated
  // to these integration checks otherwise consume the hosted runner's memory.
  supabase(["start", "--exclude", "studio,postgres-meta,imgproxy,edge-runtime,logflare,vector,supavisor"], "Fresh local Supabase startup/migrations");
  const captured = parseEnvironment(supabase(["status", "-o", "env"], "Local credential discovery"));
  localUrl(captured.API_URL, "Supabase API", ["http:", "https:"]);
  localUrl(captured.DB_URL, "Postgres", ["postgres:", "postgresql:"]);
  const names = ["API_URL", "DB_URL", "ANON_KEY", "SERVICE_ROLE_KEY"];
  assert.ok(names.every((name) => captured[name]), "Local Supabase status is incomplete.");
  writeFileSync(credentialsFile, names.map((name) => `${name}="${captured[name]}"`).join("\n") + "\n", { mode: 0o600, flag: "wx" });
  chmodSync(credentialsFile, 0o600);
  console.log("PASS: fresh unlinked local Supabase started with every committed migration; generated credentials stored privately.");
}

async function app() {
  const env = readCredentials();
  const url = localUrl(appUrl, "Next API", ["http:"]);
  assert.ok(url.port && url.hostname === "127.0.0.1", "Next API must bind explicitly to 127.0.0.1 and a dedicated port.");
  const log = openSync(fileInRunner("mentor-chat-next.log"), "wx", 0o600);
  const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "127.0.0.1", "--port", url.port], {
    cwd: root, detached: true, stdio: ["ignore", log, log], env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SITE_URL: url.origin,
      HTP_NEXT_DIST_DIR: ".next-mentor-chat-ci",
      NEXT_TELEMETRY_DISABLED: "1",
      EMAIL_MODE: "disabled", CHAT_EMAIL_MODE: "disabled", CHAT_MAINTENANCE_ENABLED: "false",
      RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", STRIPE_SECRET_KEY: "",
    },
  });
  closeSync(log);
  assert.ok(child.pid, "Could not start local Next API.");
  writeFileSync(fileInRunner("mentor-chat-next.pid"), String(child.pid), { mode: 0o600, flag: "wx" });
  child.unref();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      process.kill(child.pid, 0);
      const response = await fetch(`${url.origin}/api/chat/attachments/not-a-uuid`, { signal: AbortSignal.timeout(5000) });
      if (response.status === 404) { console.log("PASS: local Next attachment API is ready; external delivery providers are disabled."); return; }
    } catch { /* Wait for the route's first compilation and local socket. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  sanitizedDiagnostics(readFileSync(fileInRunner("mentor-chat-next.log"), "utf8"));
  throw new Error("Local Next attachment API did not become ready.");
}

function sql(file) {
  assert.ok(["tests/sql/mentor-chat-privacy-routing.sql", "tests/sql/mentor-chat-email.sql", "tests/sql/mentor-chat-profiles-presence.sql"].includes(file), "Only rollback chat SQL suites are allowed.");
  const env = readCredentials();
  const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", path.join(root, file)], { cwd: root, stdio: "inherit", env: { ...process.env, PGDATABASE: env.DB_URL }, timeout: 120_000 });
  assert.equal(result.status, 0, `Rollback SQL suite failed: ${file}`);
}

function diagnostics() {
  const env = readCredentials();
  const config = readFileSync(path.join(workdir, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
  assert.match(process.env.GITHUB_RUN_ID ?? "", /^\d+$/, "A hosted run ID is required for diagnostics.");
  assert.match(process.env.GITHUB_RUN_ATTEMPT ?? "", /^\d+$/, "A hosted attempt is required for diagnostics.");
  assert.equal(projectId, `htp-mentor-chat-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`, "Diagnostics require this exact isolated run's local project.");
  const secrets = [env.ANON_KEY, env.SERVICE_ROLE_KEY, env.DB_URL, decodeURIComponent(new URL(env.DB_URL).password)].filter(Boolean);
  function errorLines(text) {
    return text.split(/\r?\n/).flatMap((line) => {
      if (!/error|failed|exception|crash|timeout|replication|\bwal\b|slot/i.test(line)) return [];
      // Never emit request/auth payloads or credential-bearing log records.
      if (/authorization|api.?key|access.?token|refresh.?token|\bjwt\b|claims|password|secret|headers|payload|params/i.test(line)) return [];
      let safe = line;
      for (const secret of secrets) safe = safe.replaceAll(secret, "[redacted]");
      return [safe.replace(/eyJ[A-Za-z0-9_.-]+/g, "[redacted JWT]")
        .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted key]")
        .replace(/(?:https?|postgres(?:ql)?):\/\/[^\s"'<>]+/g, "[redacted URL]")
        .replace(/[^\s"'<>@]+@[^\s"'<>@]+/g, "[redacted identity]")
        .slice(0, 800)];
    }).slice(-20);
  }
  const query = `begin read only;
select json_build_object(
  'walLevel', current_setting('wal_level'),
  'publishedChatTables', (select coalesce(json_agg(tablename order by tablename), '[]'::json)
    from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
      and tablename in ('conversation_messages','conversation_threads','notification_recipients')),
  'logicalSlots', (select count(*) from pg_replication_slots where slot_type='logical'),
  'activeLogicalSlots', (select count(*) from pg_replication_slots where slot_type='logical' and active),
  'retainedWalBytes', (select coalesce(sum(pg_wal_lsn_diff(pg_current_wal_lsn(),restart_lsn)),0)
    from pg_replication_slots where slot_type='logical'),
  'unconfirmedWalBytes', (select coalesce(sum(pg_wal_lsn_diff(pg_current_wal_lsn(),confirmed_flush_lsn)),0)
    from pg_replication_slots where slot_type='logical'),
  'replicationStates', (select coalesce(json_agg(json_build_object('state',state,'syncState',sync_state)), '[]'::json)
    from pg_stat_replication),
  'realtimeTableStats', (select coalesce(json_agg(json_build_object('table',relname,'estimatedRows',n_live_tup)
    order by relname), '[]'::json) from pg_stat_user_tables where schemaname='realtime'),
  'realtimeCompositeTypes', (select coalesce(json_agg(json_build_object('type',t.typname,'attributeCount',
    (select count(*) from pg_attribute a where a.attrelid=t.typrelid and a.attnum>0 and not a.attisdropped))
    order by t.typname), '[]'::json) from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='realtime' and t.typtype='c'),
  'authenticatedChatSelect', json_build_object(
    'messages',has_table_privilege('authenticated','public.conversation_messages','SELECT'),
    'threads',has_table_privilege('authenticated','public.conversation_threads','SELECT'),
    'notifications',has_table_privilege('authenticated','public.notification_recipients','SELECT'))
);
rollback;`;
  const database = spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], {
    cwd: root, input: query, encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 20_000,
    env: { ...process.env, PGDATABASE: env.DB_URL, PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=2000" },
  });
  if (database.status === 0) console.log(`Local Realtime database diagnostics: ${JSON.stringify(JSON.parse(database.stdout.trim()))}`);
  else console.error(`Local database diagnostics unavailable (exit ${database.status}); ${errorLines(database.stderr ?? "").join("\n")}`);
  const containers = spawnSync("docker", ["ps", "-a", "--format", "{{.ID}}\t{{.Names}}"], { encoding: "utf8", timeout: 10_000 });
  if (containers.status !== 0) { console.error("Local Realtime container discovery unavailable."); return; }
  const realtime = containers.stdout.split(/\r?\n/).flatMap((line) => {
    const [id, name] = line.split("\t");
    return /^[a-f0-9]+$/.test(id ?? "") && /(?:^|[._-])realtime(?:[._-]|$)/.test(name ?? "")
      && [`.${projectId}`, `_${projectId}`, `-${projectId}`].some((suffix) => name.endsWith(suffix)) ? [id] : [];
  });
  console.log(`Local Realtime containers for this run: ${realtime.length}`);
  for (const id of realtime) {
    const logs = spawnSync("docker", ["logs", "--tail", "250", id], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 10_000 });
    const lines = errorLines(`${logs.stdout ?? ""}\n${logs.stderr ?? ""}`);
    console.log(lines.length ? `Sanitized local Realtime diagnostics:\n${lines.join("\n")}` : "No eligible Realtime error/replication lines in the last 250 container log lines.");
  }
}

function cleanup() {
  const failures = [];
  if (existsSync(credentialsFile) && existsSync(fixturesFile)) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/verify-mentor-chat-local.ts", "--cleanup"], { cwd: root, stdio: "inherit", timeout: 120_000 });
    if (result.status !== 0) failures.push("Synthetic fixture cleanup failed.");
  }
  const featureFixtures = process.env.LOCAL_CHAT_FEATURE_FIXTURE_FILE;
  if (existsSync(credentialsFile) && featureFixtures && existsSync(featureFixtures)) {
    privatePath(featureFixtures, "LOCAL_CHAT_FEATURE_FIXTURE_FILE");
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/verify-chat-features-local.ts", "--cleanup"], { cwd: root, stdio: "inherit", timeout: 120_000 });
    if (result.status !== 0) failures.push("Synthetic chat-feature cleanup failed.");
  }
  const pidFile = fileInRunner("mentor-chat-next.pid");
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, "utf8"));
    if (Number.isSafeInteger(pid) && pid > 1) {
      try { process.kill(-pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") failures.push("Local Next process cleanup failed."); }
    }
  }
  if (existsSync(path.join(workdir, "supabase", "config.toml"))) {
    try { supabase(["stop", "--no-backup"], "Isolated local Supabase cleanup"); }
    catch { failures.push("Isolated local Supabase cleanup failed."); }
  }
  for (const file of [credentialsFile, fixturesFile, pidFile, fileInRunner("mentor-chat-next.log")]) rmSync(file, { force: true });
  if (failures.length) throw new Error(failures.join(" "));
  console.log("PASS: local fixtures/processes cleaned; generated credentials removed.");
}

try {
  requireIsolatedRunner();
  const [command, arg] = process.argv.slice(2);
  if (command === "start") start();
  else if (command === "app") await app();
  else if (command === "sql") sql(arg);
  else if (command === "diagnostics") diagnostics();
  else if (command === "cleanup") cleanup();
  else throw new Error("Expected start, app, sql, diagnostics or cleanup.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local chat CI setup failed.");
  process.exitCode = 1;
}
