import assert from "node:assert/strict";
import test from "node:test";
import {
  getWeeklyUpdateAccessLabel,
  getWeeklyUpdateNotificationAudience,
} from "../../lib/weekly-update-access.ts";

test("zonder abonnementsuitrol volgen update-meldingen de Academy-leesrechten", () => {
  assert.deepEqual(getWeeklyUpdateNotificationAudience("subscription", false), {
    kind: "access_level",
    minAccessLevel: 2,
  });
  assert.equal(getWeeklyUpdateAccessLabel("subscription", false), "Academy");
  assert.equal(getWeeklyUpdateNotificationAudience("free", false), null);
});

test("na abonnementsuitrol blijven entitlement en Academy strikt gescheiden", () => {
  assert.deepEqual(getWeeklyUpdateNotificationAudience("subscription", true), {
    kind: "entitlement",
    key: "subscriber_content",
  });
  assert.equal(getWeeklyUpdateAccessLabel("subscription", true), "Subscription");
});
