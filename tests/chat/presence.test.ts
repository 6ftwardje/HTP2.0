import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_PRESENCE_TTL_MS, chatPresenceDeadline } from "../../lib/chat-presence";

test("presence expires from the server clock even when a user's clock differs", () => {
  const deadline = chatPresenceDeadline({
    student_id: "mentor",
    last_seen_at: "2026-10-17T10:00:00.000Z",
    server_now: "2026-10-17T10:00:20.000Z",
  }, 500_000);
  assert.equal(deadline, 545_000);
  assert.ok(deadline > 500_000);
  assert.ok(deadline <= 500_000 + CHAT_PRESENCE_TTL_MS);
});

test("delayed responses cannot extend an expired presence lease", () => {
  const row = {
    student_id: "mentor",
    last_seen_at: "2026-10-17T10:00:00.000Z",
    server_now: "2026-10-17T10:01:00.000Z",
  };
  assert.equal(chatPresenceDeadline(row, 500_000, 6_000), 500_000);
  assert.equal(chatPresenceDeadline(row, 500_000, 2_000), 503_000);
});

test("stale, malformed and future timestamps never create an unbounded online status", () => {
  const row = { student_id: "mentor", last_seen_at: "2026-10-17T10:00:00.000Z", server_now: "2026-10-17T10:01:05.000Z" };
  assert.equal(chatPresenceDeadline(row, 500_000), 500_000);
  assert.equal(chatPresenceDeadline({ ...row, last_seen_at: "invalid" }, 500_000), 500_000);
  assert.equal(chatPresenceDeadline({ ...row, server_now: "invalid" }, 500_000), 500_000);
  assert.equal(chatPresenceDeadline({ ...row, last_seen_at: "2030-01-01T00:00:00.000Z" }, 500_000), 565_000);
});
