import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../../", import.meta.url);

test("audit table is private and append-only", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20260927030000_admin_audit_log.sql", import.meta.url),
    "utf8"
  );
  assert.match(migration, /alter table public\.admin_audit_log enable row level security;/);
  assert.match(migration, /revoke all on public\.admin_audit_log from public, anon, authenticated;/);
  assert.match(migration, /before update or delete on public\.admin_audit_log/);
  assert.match(migration, /before truncate on public\.admin_audit_log/);
  assert.doesNotMatch(migration, /create policy/);
});

test("admin actions await audit writes before returning", () => {
  const actionsDir = join(fileURLToPath(projectRoot), "app/actions/admin");
  let callCount = 0;
  for (const file of readdirSync(actionsDir).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(join(actionsDir, file), "utf8");
    for (const line of source.split("\n")) {
      if (!line.includes("logAdminAction(")) continue;
      callCount += 1;
      assert.match(line, /\bawait logAdminAction\(/, `${file}: audit call must be awaited`);
    }
  }
  assert.ok(callCount > 30, "expected admin mutation coverage");
});
