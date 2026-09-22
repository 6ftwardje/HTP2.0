import assert from "node:assert/strict";
import test from "node:test";
import {
  assessTranscriptQuality,
  validateNumericGrounding,
  validateTranscriptEnrichment,
} from "../../lib/transcription/enrichment";

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

test("routes silence and short transcripts to review before a model call", () => {
  assert.deepEqual(
    assessTranscriptQuality([{ startSeconds: 0, endSeconds: 60, text: "[stilte]" }]),
    { usable: false, reason: "too_short" }
  );
});

test("accepts substantial synthetic Dutch transcript content", () => {
  const quality = assessTranscriptQuality([
    {
      startSeconds: 0,
      endSeconds: 40,
      text: "In dit volledig synthetische voorbeeld bespreken we twee mogelijke marktscenario's. We behandelen onzekerheid, risicobeheer en de voorwaarden waaronder ieder scenario ongeldig wordt.",
    },
  ]);
  assert.equal(quality.usable, true);
});

test("blocks a number invented outside the transcript", () => {
  const result = validateNumericGrounding(
    {
      summary: "De spreker noemt een scenario rond 4200 en een nieuw doel van 5000.",
      keyTakeaways: [],
      chapters: [],
    },
    "De spreker noemt uitsluitend het synthetische niveau 4200."
  );
  assert.deepEqual(result, { ok: false, novelClaims: ["5000"] });
});

test("keeps contradictory source figures available for human review", () => {
  const result = validateNumericGrounding(
    {
      summary: "Het transcript noemt zowel 4100 als 4200; controleer de juiste waarde.",
      keyTakeaways: ["De twee waarden spreken elkaar tegen."],
      chapters: [],
    },
    "Eerst noemt de spreker 4100 en later zegt dezelfde spreker 4200."
  );
  assert.deepEqual(result, { ok: true });
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
