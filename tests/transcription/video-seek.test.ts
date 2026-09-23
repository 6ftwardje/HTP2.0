import assert from "node:assert/strict";
import test from "node:test";
import { createVideoSeekRequest, formatChapterTime } from "../../lib/video-seek";

test("creates repeatable seek requests for the same chapter", () => {
  const first = createVideoSeekRequest(65, null);
  const second = createVideoSeekRequest(65, first);
  assert.deepEqual(first, { seconds: 65, nonce: 1 });
  assert.deepEqual(second, { seconds: 65, nonce: 2 });
});

test("formats chapter timestamps and rejects invalid seeks", () => {
  assert.equal(formatChapterTime(65), "1:05");
  assert.equal(formatChapterTime(3661), "1:01:01");
  assert.throws(() => createVideoSeekRequest(-1, null), /Ongeldige/);
});
