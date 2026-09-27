import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canShowNotificationToAccessLevel,
  STUDENT_NOTIFICATION_EVENT_TYPES,
} from "../../lib/notification-visibility.ts";

test("studenten krijgen geen oude personeelsmeldingen te zien", () => {
  assert.equal(canShowNotificationToAccessLevel(1, "student_intake.completed"), false);
  assert.equal(canShowNotificationToAccessLevel(2, "mentor_new_message"), false);
  assert.equal(canShowNotificationToAccessLevel(2, "mentor_reply"), true);
  assert.equal(canShowNotificationToAccessLevel(2, "weekly_update.published"), true);
  assert.equal(canShowNotificationToAccessLevel(2, "unexpected.staff_event"), false);
});

test("admin houdt toegang tot alle toegewezen meldingen", () => {
  assert.equal(canShowNotificationToAccessLevel(3, "student_intake.completed"), true);
  assert.equal(canShowNotificationToAccessLevel(3, "mentor_new_message"), true);
});

test("app-allowlist blijft gelijk aan de databasepolicy", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20260927010000_notification_visibility_by_role.sql", import.meta.url),
    "utf8"
  );
  const policyTypes = migration.match(/and ne\.type in \(([\s\S]*?)\)/)?.[1];
  assert.ok(policyTypes, "student event types ontbreekt in de migratie");
  const dbTypes = [...policyTypes.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(dbTypes, [...STUDENT_NOTIFICATION_EVENT_TYPES]);
});
