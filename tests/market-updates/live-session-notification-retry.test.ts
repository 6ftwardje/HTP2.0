import assert from "node:assert/strict";
import test from "node:test";
import { ensureNotificationRecipients } from "../../lib/admin/notification-delivery.ts";

test("a retry fills recipients after the event was already committed", async () => {
  const delivered = new Set(["student-a"]);
  let created = 0;

  await ensureNotificationRecipients({
    findEventId: async () => "existing-event",
    createEvent: async () => {
      created += 1;
      return "new-event";
    },
    addRecipients: async (eventId) => {
      assert.equal(eventId, "existing-event");
      for (const studentId of ["student-a", "student-b"]) delivered.add(studentId);
    },
  });

  assert.equal(created, 0);
  assert.deepEqual([...delivered].sort(), ["student-a", "student-b"]);
});

test("a concurrent unique-event insert continues with the winner's recipients", async () => {
  let lookups = 0;
  let recipientEventId = "";

  await ensureNotificationRecipients({
    findEventId: async () => (++lookups === 1 ? null : "winner-event"),
    createEvent: async () => {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    },
    addRecipients: async (eventId) => {
      recipientEventId = eventId;
    },
  });

  assert.equal(lookups, 2);
  assert.equal(recipientEventId, "winner-event");
});

test("a non-unique insert error is not hidden", async () => {
  await assert.rejects(
    ensureNotificationRecipients({
      findEventId: async () => null,
      createEvent: async () => {
        throw new Error("database unavailable");
      },
      addRecipients: async () => {
        assert.fail("must not insert recipients without an event");
      },
    }),
    /database unavailable/
  );
});
