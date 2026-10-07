import assert from "node:assert/strict";
import test from "node:test";
import { parseWebVtt } from "../../lib/transcription/vtt";

test("parses synthetic multiline WebVTT cues", () => {
  const result = parseWebVtt(`WEBVTT\n\nintro\n00:00:00.000 --> 00:00:02.500\nWelkom bij de marktanalyse.\n\n00:00:02.500 --> 00:00:05.000\nDit is synthetische\ninhoud.`);
  assert.equal(result.length, 2);
  assert.deepEqual(result[1], {
    id: "cue-2",
    startSeconds: 2.5,
    endSeconds: 5,
    text: "Dit is synthetische\ninhoud.",
  });
});

test("rejects overlapping cues", () => {
  assert.throws(
    () => parseWebVtt(`WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nEén\n\n00:00:02.000 --> 00:00:04.000\nTwee`),
    /niet-overlappend/
  );
});
