import assert from "node:assert/strict";
import test from "node:test";
import { validateTranscriptEnrichment } from "../../lib/transcription/enrichment";

test("accepts bounded synthetic Dutch enrichment", () => {
  const result = validateTranscriptEnrichment(
    {
      summary: "De spreker bespreekt een synthetisch marktscenario.",
      keyTakeaways: ["Behandel het genoemde niveau als scenario."],
      chapters: [
        { title: "Context", seconds: 0 },
        { title: "Scenario", seconds: 65 },
      ],
    },
    120
  );
  assert.equal(result.ok, true);
});

test("rejects non-monotone and out-of-range chapters", () => {
  const result = validateTranscriptEnrichment(
    {
      summary: "Synthetische samenvatting.",
      keyTakeaways: [],
      chapters: [
        { title: "Te laat", seconds: 120 },
        { title: "Terug", seconds: 20 },
      ],
    },
    120
  );
  assert.deepEqual(result, {
    ok: false,
    reason: "Hoofdstukken moeten unieke, oplopende tijden binnen de video hebben.",
  });
});
