import type { TranscriptSegment } from "./contracts";

const TIMESTAMP = /^(\d{2,}):(\d{2}):(\d{2})\.(\d{3})$/;

function parseTimestamp(value: string): number {
  const match = TIMESTAMP.exec(value.trim());
  if (!match) throw new Error(`Ongeldige WebVTT-timestamp: ${value}`);
  const [, hours, minutes, seconds, milliseconds] = match;
  if (Number(minutes) > 59 || Number(seconds) > 59) {
    throw new Error(`Ongeldige WebVTT-timestamp: ${value}`);
  }
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(milliseconds) / 1000
  );
}

export function parseWebVtt(input: string): TranscriptSegment[] {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!normalized.startsWith("WEBVTT")) throw new Error("WebVTT-header ontbreekt.");

  const blocks = normalized.split(/\n{2,}/).slice(1);
  const segments: TranscriptSegment[] = [];
  let previousEnd = 0;

  for (const [index, block] of blocks.entries()) {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length || lines[0].startsWith("NOTE")) continue;
    const timingIndex = lines.findIndex((line) => line.includes(" --> "));
    if (timingIndex < 0) continue;
    const [startRaw, endWithSettings] = lines[timingIndex].split(" --> ");
    const endRaw = endWithSettings.split(/\s+/)[0];
    const startSeconds = parseTimestamp(startRaw);
    const endSeconds = parseTimestamp(endRaw);
    const text = lines.slice(timingIndex + 1).join("\n").trim();

    if (!text) throw new Error("Een WebVTT-cue mag niet leeg zijn.");
    if (startSeconds < previousEnd || endSeconds <= startSeconds) {
      throw new Error("WebVTT-cues moeten oplopend en niet-overlappend zijn.");
    }
    segments.push({
      id: timingIndex === 1 ? lines[0] : `cue-${index + 1}`,
      startSeconds,
      endSeconds,
      text,
    });
    previousEnd = endSeconds;
  }

  return segments;
}
