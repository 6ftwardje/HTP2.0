import test from "node:test";
import assert from "node:assert/strict";
import { notificationBadgeLabel, notificationBadgeSince, notificationHref, notificationPresentation } from "../../lib/notification-policy.ts";

test("badge uses a rolling 30-day UTC boundary across DST and caps at 9+", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  assert.equal(notificationBadgeSince(now), "2026-09-26T12:00:00.000Z");
  assert.deepEqual([0,1,9,10,71].map(notificationBadgeLabel), ["0","1","9","9+","9+"]);
});
test("notification destinations stay local while valid query and fragment survive", () => {
  for (const href of [null, "", "//evil.example", "https://evil.example", "/\\evil", "/\n/evil", "javascript:alert(1)"]) assert.equal(notificationHref(href), null);
  assert.equal(notificationHref("/market-analysis/test?t=45#chart"), "/market-analysis/test?t=45#chart");
});
test("type presentation does not change authorization and unknown types stay neutral", () => {
  assert.equal(notificationPresentation("mentor_reply").label,"Vraag");
  assert.equal(notificationPresentation("weekly_update.published").kind,"update");
  assert.equal(notificationPresentation("live_session.cancelled").kind,"live");
  assert.equal(notificationPresentation("module.published").kind,"module");
  assert.equal(notificationPresentation("future.staff").kind,"system");
});
