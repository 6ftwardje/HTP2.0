import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { isPlatformAdmin } from "../../lib/admin/authorization";
import {
  executeTranscriptEnrichment,
  type EnrichmentJobStore,
  type EnrichmentProvider,
} from "../../lib/ai/transcript-enrichment";
import { unwrapMuxCaptionEvent } from "../../lib/transcription/mux-webhook";
import { projectPublishedVideoEnrichment } from "../../lib/transcription/public-enrichment";
import { validateReviewTransition } from "../../lib/transcription/review-policy";
import { nextWorkflowStep } from "../../lib/transcription/workflow";
import { parseWebVtt } from "../../lib/transcription/vtt";
import type { TranscriptEnrichment } from "../../lib/transcription/enrichment";

const WEBHOOK_SECRET = "synthetic_acceptance_webhook_secret";
const PRICING = {
  inputEuroPerMillionTokens: 1,
  outputEuroPerMillionTokens: 5,
  validUntil: "2099-12-31",
};
const GENERATED: TranscriptEnrichment = {
  summary: "De spreker bespreekt een synthetisch scenario rond niveau 4200 en benadrukt risicobeheer.",
  keyTakeaways: ["Controleer onzekerheid en het risicoplan voordat conclusies worden getrokken."],
  chapters: [{ title: "Scenario rond 4200", seconds: 0 }],
};

function signedHeaders(body: string) {
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return new Headers({ "mux-signature": `t=${timestamp},v1=${signature}` });
}

function syntheticTranscript() {
  return parseWebVtt(`WEBVTT

00:00:00.000 --> 00:00:30.000
In dit volledig synthetische marktvoorbeeld bespreken we scenario niveau 4200. De spreker benadrukt onzekerheid, menselijke controle en een duidelijk risicoplan voordat iemand conclusies trekt.

00:00:30.000 --> 00:01:00.000
Daarna volgt een samenvatting zonder financieel advies, met aandacht voor discipline, positiegrootte en controle van de oorspronkelijke bron.`);
}

test("synthetic happy path reaches an approved student-safe projection", async () => {
  const body = JSON.stringify({
    id: "event_acceptance",
    type: "video.asset.track.ready",
    data: {
      id: "track_acceptance",
      asset_id: "asset_acceptance",
      type: "text",
      text_type: "subtitles",
      text_source: "generated_vod",
      language_code: "nl",
    },
  });
  const event = await unwrapMuxCaptionEvent(body, signedHeaders(body), WEBHOOK_SECRET);
  assert.equal(event?.languageCode, "nl");

  const transcript = syntheticTranscript();
  assert.equal(transcript.length, 2);
  let savedDraft: TranscriptEnrichment | null = null;
  let providerCalls = 0;
  let successfulCostRecords = 0;
  const store: EnrichmentJobStore = {
    async claim() {
      return { enrichmentId: "enrichment_acceptance", claimed: true, status: "processing" };
    },
    async monthSpendEuro() { return 0; },
    async saveDraft(input) {
      savedDraft = input.output;
      successfulCostRecords += 1;
    },
    async fail() { throw new Error("Happy path mag niet falen."); },
  };
  const provider: EnrichmentProvider = {
    async generate() {
      providerCalls += 1;
      return { output: GENERATED, usage: { inputTokens: 180, outputTokens: 70 } };
    },
  };
  const result = await executeTranscriptEnrichment({
    transcriptId: "transcript_acceptance",
    transcript,
    durationSeconds: 60,
    promptVersion: "market-insight-v1",
    model: "synthetic-model",
    provider,
    store,
    pricing: PRICING,
  });
  assert.equal(result.status, "draft");
  assert.equal(providerCalls, 1);
  assert.equal(successfulCostRecords, 1);

  const review = validateReviewTransition({
    currentStatus: "draft",
    content: savedDraft,
    durationSeconds: 60,
    action: "publish",
    confirmed: true,
  });
  assert.equal(review.ok, true);
  const publicProjection = projectPublishedVideoEnrichment({
    status: "published",
    summary: GENERATED.summary,
    key_takeaways: GENERATED.keyTakeaways,
    chapters: GENERATED.chapters,
    published_at: "2026-09-23T12:00:00.000Z",
    transcript: transcript,
    provider_track_id: "track_acceptance",
  } as Parameters<typeof projectPublishedVideoEnrichment>[0]);
  assert.deepEqual(publicProjection, {
    summary: GENERATED.summary,
    keyTakeaways: GENERATED.keyTakeaways,
    chapters: GENERATED.chapters,
    publishedAt: "2026-09-23T12:00:00.000Z",
  });
  const visible = JSON.stringify(publicProjection);
  assert.equal(visible.includes("track_acceptance"), false);
  assert.equal(visible.includes(transcript[0].text), false);
});

test("drafts stay hidden and only platform admins pass the management boundary", () => {
  assert.equal(projectPublishedVideoEnrichment({
    status: "draft",
    summary: GENERATED.summary,
    key_takeaways: GENERATED.keyTakeaways,
    chapters: GENERATED.chapters,
    published_at: null,
  }), null);
  assert.equal(isPlatformAdmin({ access_level: 3 }), true);
  assert.equal(isPlatformAdmin({ access_level: 2 }), false);
  assert.equal(isPlatformAdmin(null), false);
});

test("retryable failure produces one final output without duplicate cost", async () => {
  const transcript = syntheticTranscript();
  let status: "new" | "failed" | "draft" = "new";
  let providerCalls = 0;
  let savedDrafts = 0;
  let successfulCostRecords = 0;
  const store: EnrichmentJobStore = {
    async claim() {
      if (status === "draft") {
        return { enrichmentId: "enrichment_retry", claimed: false, status: "draft" };
      }
      status = "new";
      return { enrichmentId: "enrichment_retry", claimed: true, status: "processing" };
    },
    async monthSpendEuro() { return 0; },
    async saveDraft() {
      status = "draft";
      savedDrafts += 1;
      successfulCostRecords += 1;
    },
    async fail(input) {
      assert.equal(input.retryable, true);
      status = "failed";
    },
  };
  const provider: EnrichmentProvider = {
    async generate() {
      providerCalls += 1;
      if (providerCalls === 1) {
        throw Object.assign(new Error("synthetic timeout"), {
          code: "timeout",
          retryable: true,
        });
      }
      return { output: GENERATED, usage: { inputTokens: 180, outputTokens: 70 } };
    },
  };
  const input = {
    transcriptId: "transcript_retry",
    transcript,
    durationSeconds: 60,
    promptVersion: "market-insight-v1",
    model: "synthetic-model",
    provider,
    store,
    pricing: PRICING,
  };
  assert.equal((await executeTranscriptEnrichment(input)).status, "failed");
  assert.equal((await executeTranscriptEnrichment(input)).status, "draft");
  assert.equal((await executeTranscriptEnrichment(input)).status, "existing");
  assert.deepEqual(
    { providerCalls, savedDrafts, successfulCostRecords },
    { providerCalls: 2, savedDrafts: 1, successfulCostRecords: 1 }
  );
});

test("MVP workflow has no implicit translation step", () => {
  assert.equal(nextWorkflowStep({ transcriptStatus: "processing", hasEnrichment: false }), "fetch_transcript");
  assert.equal(nextWorkflowStep({ transcriptStatus: "ready", hasEnrichment: false }), "enrich");
  assert.equal(nextWorkflowStep({
    transcriptStatus: "ready",
    hasEnrichment: true,
    enrichmentStatus: "draft",
  }), "review");
  assert.equal(nextWorkflowStep({
    transcriptStatus: "ready",
    hasEnrichment: true,
    enrichmentStatus: "published",
  }), "complete");
});
