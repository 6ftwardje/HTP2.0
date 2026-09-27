import assert from "node:assert/strict";
import test from "node:test";
import { repairableLiveSessionNotificationType } from "../../lib/admin/live-session-notification-repair.ts";

const now = new Date("2026-09-27T12:00:00Z");

test("published upcoming and live sessions can repair the scheduled notice", () => {
  for (const status of ["scheduled", "live"]) {
    assert.equal(
      repairableLiveSessionNotificationType({ is_published: true, status, ends_at: "2026-09-27T13:00:00Z" }, now),
      "live_session.scheduled"
    );
  }
});

test("published cancelled sessions can repair the cancellation notice", () => {
  assert.equal(
    repairableLiveSessionNotificationType({ is_published: true, status: "cancelled", ends_at: "2026-09-27T11:00:00Z" }, now),
    "live_session.cancelled"
  );
});

test("drafts and old sessions cannot send stale notifications", () => {
  assert.equal(repairableLiveSessionNotificationType({ is_published: false, status: "draft", ends_at: "2026-09-28T12:00:00Z" }, now), null);
  assert.equal(repairableLiveSessionNotificationType({ is_published: true, status: "scheduled", ends_at: "2026-09-27T11:00:00Z" }, now), null);
  assert.equal(repairableLiveSessionNotificationType({ is_published: true, status: "completed", ends_at: "2026-09-27T11:00:00Z" }, now), null);
});
