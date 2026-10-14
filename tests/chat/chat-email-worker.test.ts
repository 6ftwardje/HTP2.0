import assert from "node:assert/strict";
import test from "node:test";
import {
  chatEmailEligibility,
  readChatEmailConfig,
  type ChatEmailJob,
  type ChatEmailSnapshot,
} from "../../lib/chat-notifications/policy.ts";
import {
  runChatEmailBatch,
  type ChatEmailRepository,
  type ChatEmailStatus,
} from "../../lib/chat-notifications/worker.ts";
import { createChatResendProvider } from "../../lib/chat-notifications/resend.ts";
import { EmailDeliveryError, type EmailPayload, type EmailProvider } from "../../lib/chat-notifications/types.ts";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const options = { now: () => NOW, maxMessages: 10, random: () => 0 };

function technicalEnvironment(mode: "live" | "dry_run" = "live"): Record<string, string | undefined> {
  return {
    CHAT_EMAIL_MODE: mode,
    EMAIL_FROM: "Het Trade Platform <chat@example.com>",
    EMAIL_REPLY_TO: "support@example.com",
    NEXT_PUBLIC_SITE_URL: "https://platform.example.com",
    RESEND_API_KEY: "test-key-never-sent",
    CHAT_MAINTENANCE_SECRET: "test-maintenance-secret-at-least-32-characters",
  };
}

function config(mode: "live" | "dry_run" = "live") {
  return readChatEmailConfig(technicalEnvironment(mode));
}

function job(overrides: Partial<ChatEmailJob> = {}): ChatEmailJob {
  return {
    id: "notification-a",
    thread_id: "thread-a",
    recipient_student_id: "student-a",
    recipient_role: "student",
    mentor_student_id: "rouss",
    last_public_seq: 12,
    lease_token: "lease-a",
    attempts: 0,
    first_attempt_at: null,
    payload: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<Extract<ChatEmailSnapshot, { allowed: true }>> = {}): ChatEmailSnapshot {
  return {
    allowed: true,
    email: "student@example.com",
    recipientStudentId: "student-a",
    recipientRole: "student",
    mentorStudentId: "rouss",
    threadId: "thread-a",
    lastReadSeq: 10,
    lastPublicSeq: 12,
    ...overrides,
  };
}

type Completion = { job: ChatEmailJob; status: ChatEmailStatus; reason: string | null; dueAt: Date; providerId?: string };

class MemoryRepository implements ChatEmailRepository {
  queue: ChatEmailJob[];
  state: ChatEmailSnapshot = snapshot();
  activeLease = "lease-a";
  claims = 0;
  snapshots = 0;
  preparations: EmailPayload[] = [];
  completions: Completion[] = [];
  frozenPayload: EmailPayload | null = null;
  beforePrepare: ((claimed: ChatEmailJob) => void) | null = null;
  rejectSentAcknowledgement = false;

  constructor(jobs: ChatEmailJob[] = [job()]) { this.queue = jobs; }

  async claim() {
    this.claims++;
    return this.queue.shift() ?? null;
  }

  async snapshot() {
    this.snapshots++;
    return structuredClone(this.state);
  }

  async prepare(claimed: ChatEmailJob, payload: EmailPayload) {
    this.preparations.push(structuredClone(payload));
    this.beforePrepare?.(claimed);
    // Model the repository contract: the final gate independently reads the
    // current state and rejects an expired lease before capturing a payload.
    if (claimed.lease_token !== this.activeLease || chatEmailEligibility(claimed, this.state)) return null;
    this.frozenPayload ??= structuredClone(payload);
    return structuredClone(this.frozenPayload);
  }

  async finish(claimed: ChatEmailJob, status: ChatEmailStatus, reason: string | null, dueAt: Date, providerId?: string) {
    if (status === "sent" && this.rejectSentAcknowledgement) {
      this.rejectSentAcknowledgement = false;
      throw new Error("database acknowledgement lost");
    }
    this.completions.push({ job: claimed, status, reason, dueAt, providerId });
  }
}

class RecordingProvider implements EmailProvider {
  deliveries: { payload: EmailPayload; idempotencyKey: string }[] = [];
  failures: Error[] = [];

  async send(payload: EmailPayload, idempotencyKey: string) {
    this.deliveries.push({ payload: structuredClone(payload), idempotencyKey });
    const failure = this.failures.shift();
    if (failure) throw failure;
    return "provider-message-a";
  }
}

test("chat email is disabled by default, even when the separate email worker is live", async () => {
  for (const env of [{}, { EMAIL_MODE: "live" }, { CHAT_EMAIL_MODE: "unexpected" }]) {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    const result = await runChatEmailBatch(readChatEmailConfig(env), repository, provider, options);
    assert.equal(result.mode, "disabled");
    assert.equal(repository.claims, 0);
    assert.equal(repository.snapshots, 0);
    assert.equal(repository.preparations.length, 0);
    assert.equal(provider.deliveries.length, 0);
  }
});

test("live and dry-run both require the actual transport and maintenance configuration", async () => {
  for (const mode of ["live", "dry_run"] as const) {
    for (const key of ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO", "NEXT_PUBLIC_SITE_URL", "CHAT_MAINTENANCE_SECRET"]) {
      const environment = technicalEnvironment(mode);
      delete environment[key];
      const repository = new MemoryRepository();
      const provider = new RecordingProvider();
      const result = await runChatEmailBatch(readChatEmailConfig(environment), repository, provider, options);
      assert.ok(result.blockers.length > 0, `${mode}: missing ${key} must block delivery`);
      assert.equal(repository.claims, 0);
      assert.equal(provider.deliveries.length, 0);
      assert.ok(!result.blockers.includes("disabled"));
      assert.ok(!result.blockers.includes("dry_run"));
    }
  }
});

test("invalid sender, reply address, site URL and maintenance secret block delivery", async (t) => {
  const invalid: { key: string; value: string }[] = [
    { key: "EMAIL_FROM", value: "not-an-address" },
    { key: "EMAIL_FROM", value: "Chat <chat@example.com>\r\nBcc: other@example.com" },
    { key: "EMAIL_REPLY_TO", value: "not-an-address" },
    { key: "EMAIL_REPLY_TO", value: "support@example.com\nBcc: other@example.com" },
    { key: "NEXT_PUBLIC_SITE_URL", value: "http://platform.example.com" },
    { key: "NEXT_PUBLIC_SITE_URL", value: "not-a-url" },
    { key: "NEXT_PUBLIC_SITE_URL", value: "https://name:password@platform.example.com" },
    { key: "CHAT_MAINTENANCE_SECRET", value: "x".repeat(31) },
  ];
  for (const { key, value } of invalid) {
    await t.test(`${key}: ${JSON.stringify(value)}`, async () => {
      const repository = new MemoryRepository();
      const provider = new RecordingProvider();
      const result = await runChatEmailBatch(readChatEmailConfig({ ...technicalEnvironment(), [key]: value }), repository, provider, options);
      assert.ok(result.blockers.length > 0);
      assert.equal(repository.claims, 0);
      assert.equal(provider.deliveries.length, 0);
    });
  }
});

test("transactional chat delivery is independent of absent or false marketing approval flags", async () => {
  for (const approvals of [{}, {
    EMAIL_DNS_VERIFIED: "false",
    EMAIL_CONSENT_APPROVED: "false",
    EMAIL_PRIVACY_APPROVED: "false",
    EMAIL_TEMPLATES_APPROVED: "false",
    EMAIL_MODE: "disabled",
  }]) {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    const technicalConfig = readChatEmailConfig({ ...technicalEnvironment(), ...approvals });
    assert.deepEqual(technicalConfig.blockers, []);
    const result = await runChatEmailBatch(technicalConfig, repository, provider, options);
    assert.equal(result.sent, 1);
    assert.equal(provider.deliveries.length, 1);
  }
});

test("configured dry-run checks eligibility without preparing or sending a message", async () => {
  const repository = new MemoryRepository();
  const provider = new RecordingProvider();
  const result = await runChatEmailBatch(config("dry_run"), repository, provider, options);
  assert.equal(result.previewed, 1);
  assert.equal(result.sent, 0);
  assert.equal(repository.snapshots, 1);
  assert.equal(repository.preparations.length, 0);
  assert.equal(repository.frozenPayload, null);
  assert.equal(provider.deliveries.length, 0);
  assert.deepEqual(repository.completions.map(({ status, reason, dueAt }) => ({ status, reason, dueAt })), [
    { status: "queued", reason: "dry_run_checked", dueAt: new Date(NOW.getTime() + 60000) },
  ]);
});

test("a free student's notification needs no billing or marketing enrollment state", async () => {
  const repository = new MemoryRepository();
  const provider = new RecordingProvider();
  const result = await runChatEmailBatch(config(), repository, provider, options);
  assert.equal(result.sent, 1);
  assert.equal(provider.deliveries[0].payload.to, "student@example.com");
  assert.equal(provider.deliveries[0].idempotencyKey, "chat-email:notification-a");
  assert.equal(repository.completions[0].providerId, "provider-message-a");
  assert.equal(repository.completions[0].status, "sent");
});

test("the provider receives only a generic notification and authenticated chat link", async () => {
  const privateJob = {
    ...job(),
    body: "PRIVATE trading question and portfolio balance",
    student_name: "PRIVATE student's full name",
    metadata: { internal_note: "PRIVATE mentor note" },
  };
  const repository = new MemoryRepository([privateJob]);
  const provider = new RecordingProvider();
  await runChatEmailBatch(config(), repository, provider, options);
  const payload = provider.deliveries[0].payload;
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /PRIVATE|portfolio balance|internal_note|student_name/);
  assert.match(payload.text, /https:\/\/platform\.example\.com\/mentor(?:\s|$)/);
  assert.match(payload.html, /href="https:\/\/platform\.example\.com\/mentor"/);
  assert.equal(payload.subject, "Je hebt een ongelezen chatbericht");
  assert.deepEqual(payload.tags, [
    { name: "chat_notification_id", value: "notification-a" },
    { name: "kind", value: "chat_unread" },
  ]);
});

test("mentor notifications target the configured Rousso identity and its selected conversation", async () => {
  const repository = new MemoryRepository([job({ recipient_student_id: "rouss", recipient_role: "mentor", thread_id: "thread/a?b" })]);
  repository.state = snapshot({ email: "rouss@example.com", recipientStudentId: "rouss", recipientRole: "mentor", threadId: "thread/a?b" });
  const provider = new RecordingProvider();
  await runChatEmailBatch(config(), repository, provider, options);
  assert.equal(provider.deliveries.length, 1);
  assert.equal(provider.deliveries[0].payload.to, "rouss@example.com");
  assert.match(provider.deliveries[0].payload.text, /\/mentor-inbox\?thread=thread%2Fa%3Fb/);
});

test("revoked, suppressed, read, missing and changed recipients are cancelled before preparation", async (t) => {
  const cases: { name: string; state: ChatEmailSnapshot; reason: string }[] = [
    { name: "revoked participant", state: { allowed: false, reason: "participant_revoked" }, reason: "participant_revoked" },
    { name: "email preference disabled", state: { allowed: false, reason: "email_disabled" }, reason: "email_disabled" },
    { name: "provider suppression", state: { allowed: false, reason: "suppressed" }, reason: "suppressed" },
    { name: "expired disabled-pilot backlog", state: { allowed: false, reason: "notification_expired" }, reason: "notification_expired" },
    { name: "wrong student", state: snapshot({ recipientStudentId: "student-b" }), reason: "recipient_changed" },
    { name: "wrong role", state: snapshot({ recipientRole: "mentor" }), reason: "recipient_changed" },
    { name: "wrong mentor", state: snapshot({ mentorStudentId: "other-admin" }), reason: "recipient_changed" },
    { name: "wrong conversation", state: snapshot({ threadId: "thread-b" }), reason: "recipient_changed" },
    { name: "read while queued", state: snapshot({ lastReadSeq: 12 }), reason: "already_read" },
    { name: "message removed", state: snapshot({ lastPublicSeq: 11 }), reason: "message_unavailable" },
    { name: "missing email", state: snapshot({ email: "" }), reason: "email_unavailable" },
    { name: "malformed email", state: snapshot({ email: "student\n@example.com" }), reason: "email_unavailable" },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const repository = new MemoryRepository();
      repository.state = scenario.state;
      const provider = new RecordingProvider();
      const result = await runChatEmailBatch(config(), repository, provider, options);
      assert.equal(result.cancelled, 1);
      assert.equal(repository.preparations.length, 0);
      assert.equal(provider.deliveries.length, 0);
      assert.equal(repository.completions[0].status, "cancelled");
      assert.equal(repository.completions[0].reason, scenario.reason);
    });
  }
});

test("the final atomic gate cancels read, revocation, recipient, preference and suppression races", async (t) => {
  const changes: { name: string; state: ChatEmailSnapshot }[] = [
    { name: "read on another device", state: snapshot({ lastReadSeq: 12 }) },
    { name: "access revoked", state: { allowed: false, reason: "participant_revoked" } },
    { name: "Rousso replaced", state: snapshot({ mentorStudentId: "other-admin" }) },
    { name: "recipient replaced", state: snapshot({ recipientStudentId: "student-b" }) },
    { name: "email preference disabled", state: { allowed: false, reason: "email_disabled" } },
    { name: "email suppressed", state: { allowed: false, reason: "suppressed" } },
  ];
  for (const change of changes) {
    await t.test(change.name, async () => {
      const repository = new MemoryRepository();
      repository.beforePrepare = () => { repository.state = change.state; };
      const provider = new RecordingProvider();
      const result = await runChatEmailBatch(config(), repository, provider, options);
      assert.equal(repository.snapshots, 1);
      assert.equal(repository.preparations.length, 1);
      assert.equal(repository.frozenPayload, null);
      assert.equal(provider.deliveries.length, 0);
      assert.equal(result.cancelled, 1);
      assert.equal(repository.completions[0].reason, "eligibility_or_lease_changed");
    });
  }
});

test("concurrent workers cannot deliver a duplicate claim and an expired lease", async () => {
  const repository = new MemoryRepository([
    job({ lease_token: "expired-lease" }),
    job({ lease_token: "winning-lease" }),
  ]);
  repository.activeLease = "winning-lease";
  const provider = new RecordingProvider();
  const runs = await Promise.all([
    runChatEmailBatch(config(), repository, provider, { ...options, maxMessages: 1 }),
    runChatEmailBatch(config(), repository, provider, { ...options, maxMessages: 1 }),
  ]);
  assert.equal(runs.reduce((total, result) => total + result.sent, 0), 1);
  assert.equal(runs.reduce((total, result) => total + result.cancelled, 0), 1);
  assert.equal(provider.deliveries.length, 1);
  assert.equal(provider.deliveries[0].idempotencyKey, "chat-email:notification-a");
  assert.equal(repository.completions.find((completion) => completion.status === "sent")?.job.lease_token, "winning-lease");
});

test("a lost provider response retries the immutable payload under the same idempotency key", async () => {
  const repository = new MemoryRepository();
  const provider = new RecordingProvider();
  provider.failures = [new Error("response lost after provider acceptance")];
  const first = await runChatEmailBatch(config(), repository, provider, options);
  assert.equal(first.failed, 1);
  assert.equal(repository.completions[0].status, "retry");
  assert.equal(repository.completions[0].reason, "delivery_outcome_unknown");
  assert.ok(repository.frozenPayload);

  repository.activeLease = "retry-lease";
  repository.queue = [job({
    lease_token: "retry-lease",
    attempts: 1,
    first_attempt_at: NOW.toISOString(),
    payload: structuredClone(repository.frozenPayload),
  })];
  const changedConfig = config();
  changedConfig.email.from = "Changed sender <changed@example.com>";
  changedConfig.email.replyTo = "changed@example.com";
  changedConfig.email.siteUrl = "https://changed.example.com";
  const retry = await runChatEmailBatch(changedConfig, repository, provider, options);
  assert.equal(retry.sent, 1);
  assert.equal(provider.deliveries.length, 2);
  assert.deepEqual(provider.deliveries[1], provider.deliveries[0]);
  assert.equal(repository.completions.at(-1)?.status, "sent");
});

test("a recipient email change cancels a frozen retry instead of delivering its old payload", async () => {
  const repository = new MemoryRepository();
  const provider = new RecordingProvider();
  await runChatEmailBatch(config(), repository, provider, options);
  assert.ok(repository.frozenPayload);
  repository.queue = [job({ payload: repository.frozenPayload, attempts: 1, first_attempt_at: NOW.toISOString() })];
  repository.state = snapshot({ email: "new-address@example.com" });
  const result = await runChatEmailBatch(config(), repository, provider, options);
  assert.equal(result.cancelled, 1);
  assert.equal(provider.deliveries.length, 1);
  assert.equal(repository.completions.at(-1)?.reason, "email_changed");
});

test("a lost database acknowledgement leaves a retry with the original delivery identity", async () => {
  const repository = new MemoryRepository();
  repository.rejectSentAcknowledgement = true;
  const provider = new RecordingProvider();
  const first = await runChatEmailBatch(config(), repository, provider, options);
  assert.equal(first.failed, 1);
  assert.equal(repository.completions[0].status, "retry");
  assert.equal(repository.completions[0].reason, "delivery_outcome_unknown");
  assert.ok(repository.frozenPayload);
  repository.queue = [job({ payload: repository.frozenPayload, attempts: 1, first_attempt_at: NOW.toISOString() })];
  const retry = await runChatEmailBatch(config(), repository, provider, options);
  assert.equal(retry.sent, 1);
  assert.deepEqual(provider.deliveries[1], provider.deliveries[0]);
});

test("unknown delivery outcomes stop before the provider idempotency window expires", async () => {
  const repository = new MemoryRepository([job({ first_attempt_at: new Date(NOW.getTime() - 23 * 3600000).toISOString(), attempts: 1 })]);
  const provider = new RecordingProvider();
  const result = await runChatEmailBatch(config(), repository, provider, options);
  assert.equal(result.failed, 1);
  assert.equal(repository.preparations.length, 0);
  assert.equal(provider.deliveries.length, 0);
  assert.equal(repository.completions[0].status, "needs_review");
  assert.equal(repository.completions[0].reason, "idempotency_window_elapsed");
});

test("permanent provider failures do not retry and exhausted transient failures require review", async (t) => {
  await t.test("permanent failure", async () => {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    provider.failures = [new EmailDeliveryError("invalid_sender", false)];
    await runChatEmailBatch(config(), repository, provider, options);
    assert.equal(repository.completions[0].status, "failed");
    assert.equal(repository.completions[0].reason, "invalid_sender");
  });
  await t.test("eighth delivery failure", async () => {
    const repository = new MemoryRepository([job({ attempts: 7, first_attempt_at: NOW.toISOString() })]);
    const provider = new RecordingProvider();
    provider.failures = [new EmailDeliveryError("rate_limited", true)];
    await runChatEmailBatch(config(), repository, provider, options);
    assert.equal(repository.completions[0].status, "needs_review");
    assert.equal(repository.completions[0].reason, "rate_limited");
  });
});

function transportPayload(): EmailPayload {
  return {
    from: "Het Trade Platform <chat@example.com>",
    to: "student@example.com",
    replyTo: "support@example.com",
    subject: "Je hebt een ongelezen chatbericht",
    html: "<p>Open je gesprek</p>",
    text: "Open je gesprek",
    tags: [{ name: "kind", value: "chat_unread" }],
  };
}

test("the transport independently prevents fetch in disabled, dry-run and misconfigured modes", async () => {
  let requests = 0;
  const request: typeof fetch = async () => {
    requests++;
    assert.fail("disabled transport must not perform an HTTP request");
  };
  const configurations = [readChatEmailConfig({}), config("dry_run"), { ...config(), blockers: ["missing_worker_secret"] }];
  for (const configuration of configurations) {
    const provider = createChatResendProvider(configuration, request);
    await assert.rejects(provider.send(transportPayload(), "chat-email:notification-a"), (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.code, "delivery_disabled");
      assert.equal(error.retryable, false);
      return true;
    });
  }
  assert.equal(requests, 0);
});

test("the chat transport preserves provider idempotency and maps reply_to without mutating its payload", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const request: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ id: "provider-message-a" }), { status: 200 });
  };
  const payload = transportPayload();
  const original = structuredClone(payload);
  const provider = createChatResendProvider(config(), request);
  assert.equal(await provider.send(payload, "chat-email:notification-a"), "provider-message-a");
  assert.equal(await provider.send(payload, "chat-email:notification-a"), "provider-message-a");
  assert.equal(requests.length, 2);
  const { replyTo, ...otherFields } = original;
  for (const recorded of requests) {
    assert.equal(recorded.url, "https://api.resend.com/emails");
    assert.equal(recorded.init.method, "POST");
    const headers = new Headers(recorded.init.headers);
    assert.equal(headers.get("Idempotency-Key"), "chat-email:notification-a");
    assert.equal(headers.get("Authorization"), "Bearer test-key-never-sent");
    assert.deepEqual(JSON.parse(String(recorded.init.body)), { ...otherFields, reply_to: replyTo });
  }
  assert.equal(requests[1].init.body, requests[0].init.body);
  assert.deepEqual(payload, original);
});

test("transport errors preserve only a safe code and distinguish retryable outcomes", async (t) => {
  const cases = [
    { status: 400, body: { message: "PRIVATE invalid recipient student@example.com" }, retryable: false },
    { status: 429, body: { message: "PRIVATE provider error" }, retryable: true },
    { status: 503, body: { message: "PRIVATE provider error" }, retryable: true },
    { status: 409, body: { name: "concurrent_idempotent_requests" }, retryable: true },
    { status: 409, body: { name: "invalid_idempotent_request" }, retryable: false },
  ];
  for (const scenario of cases) {
    await t.test(`${scenario.status}: ${scenario.body.name ?? "provider error"}`, async () => {
      const request: typeof fetch = async () => new Response(JSON.stringify(scenario.body), { status: scenario.status });
      const provider = createChatResendProvider(config(), request);
      await assert.rejects(provider.send(transportPayload(), "chat-email:notification-a"), (error) => {
        assert.ok(error instanceof EmailDeliveryError);
        assert.equal(error.code, `resend_http_${scenario.status}`);
        assert.equal(error.retryable, scenario.retryable);
        assert.doesNotMatch(error.message, /PRIVATE|student@example\.com/);
        return true;
      });
    });
  }
});
