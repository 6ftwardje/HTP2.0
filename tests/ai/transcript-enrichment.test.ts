import assert from "node:assert/strict";
import test from "node:test";
import {
  executeTranscriptEnrichment,
  type EnrichmentJobStore,
  type EnrichmentProvider,
} from "../../lib/ai/transcript-enrichment";

const transcript = [
  {
    id: "cue-1",
    startSeconds: 0,
    endSeconds: 30,
    text: "In dit volledig synthetische marktvoorbeeld bespreken we het scenario rond niveau 4200. De spreker benadrukt onzekerheid en controle van het risicoplan voordat iemand conclusies trekt.",
  },
];

function setup() {
  let claimed = false;
  let calls = 0;
  let saved = 0;
  const store: EnrichmentJobStore = {
    async claim() {
      if (claimed) return { enrichmentId: "enrichment-1", claimed: false, status: "draft" };
      claimed = true;
      return { enrichmentId: "enrichment-1", claimed: true, status: "processing" };
    },
    async monthSpendEuro() { return 0; },
    async saveDraft() { saved += 1; },
    async fail() {},
  };
  const provider: EnrichmentProvider = {
    async generate() {
      calls += 1;
      return {
        output: {
          summary: "De spreker bespreekt een synthetisch scenario rond 4200.",
          keyTakeaways: ["Onzekerheid en risicocontrole staan centraal."],
          chapters: [{ title: "Scenario rond 4200", seconds: 0 }],
        },
        usage: { inputTokens: 120, outputTokens: 60 },
      };
    },
  };
  return { store, provider, counts: () => ({ calls, saved }) };
}

test("same transcript, prompt and model cause only one provider call", async () => {
  const fixture = setup();
  const input = {
    transcriptId: "transcript-1",
    transcript,
    durationSeconds: 60,
    promptVersion: "market-insight-v1",
    model: "synthetic-model",
    provider: fixture.provider,
    store: fixture.store,
    pricing: {
      inputEuroPerMillionTokens: 1,
      outputEuroPerMillionTokens: 5,
      validUntil: "2099-12-31",
    },
  };
  assert.equal((await executeTranscriptEnrichment(input)).status, "draft");
  assert.equal((await executeTranscriptEnrichment(input)).status, "existing");
  assert.deepEqual(fixture.counts(), { calls: 1, saved: 1 });
});

test("expired pricing blocks before the provider call", async () => {
  const fixture = setup();
  const result = await executeTranscriptEnrichment({
    transcriptId: "transcript-1",
    transcript,
    durationSeconds: 60,
    promptVersion: "market-insight-v1",
    model: "synthetic-model",
    provider: fixture.provider,
    store: fixture.store,
    pricing: {
      inputEuroPerMillionTokens: 1,
      outputEuroPerMillionTokens: 5,
      validUntil: "2020-01-01",
    },
    now: new Date("2026-09-23T00:00:00Z"),
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(fixture.counts(), { calls: 0, saved: 0 });
});
