import assert from "node:assert/strict";
import test from "node:test";
import { validateReviewTransition } from "../../lib/transcription/review-policy";

const validContent = {
  summary: "Synthetische samenvatting voor menselijke review.",
  keyTakeaways: ["Dit is geen financieel advies."],
  chapters: [{ title: "Inleiding", seconds: 0 }],
};

test("publish requires explicit confirmation", () => {
  assert.deepEqual(
    validateReviewTransition({
      currentStatus: "review",
      content: validContent,
      durationSeconds: 60,
      action: "publish",
      confirmed: false,
    }),
    { ok: false, reason: "Bevestig publicatie expliciet." }
  );
});

test("chapters outside video duration block publication", () => {
  const result = validateReviewTransition({
    currentStatus: "draft",
    content: { ...validContent, chapters: [{ title: "Te laat", seconds: 60 }] },
    durationSeconds: 60,
    action: "publish",
    confirmed: true,
  });
  assert.equal(result.ok, false);
});

test("published and rejected content is immutable", () => {
  for (const status of ["published", "rejected"]) {
    assert.equal(
      validateReviewTransition({
        currentStatus: status,
        content: validContent,
        durationSeconds: 60,
        action: "save",
      }).ok,
      false
    );
  }
});
