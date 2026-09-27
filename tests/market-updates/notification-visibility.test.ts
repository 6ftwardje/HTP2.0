import assert from "node:assert/strict";
import test from "node:test";
import { canShowNotificationToAccessLevel } from "../../lib/notification-visibility.ts";

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
