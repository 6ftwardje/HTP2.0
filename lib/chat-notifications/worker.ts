import { EmailDeliveryError, type EmailPayload, type EmailProvider } from "./types";
import { chatEmailEligibility, type ChatEmailConfig, type ChatEmailJob, type ChatEmailSnapshot } from "./policy";
import { renderChatNotification } from "./templates";

export type ChatEmailStatus = "queued" | "retry" | "sent" | "cancelled" | "failed" | "needs_review";
export type ChatEmailRepository = {
  claim(): Promise<ChatEmailJob | null>;
  snapshot(job: ChatEmailJob): Promise<ChatEmailSnapshot>;
  // Must atomically validate the live recipient/read state and lease, then freeze payload.
  prepare(job: ChatEmailJob, payload: EmailPayload): Promise<EmailPayload | null>;
  finish(job: ChatEmailJob, status: ChatEmailStatus, reason: string | null, dueAt: Date, providerId?: string): Promise<void>;
};

export async function runChatEmailBatch(config: ChatEmailConfig, repository: ChatEmailRepository, provider: EmailProvider,
  options: { now?: () => Date; maxMessages?: number; deadlineMs?: number; random?: () => number } = {}) {
  const now = options.now ?? (() => new Date());
  const result = { mode: config.mode, sent: 0, previewed: 0, cancelled: 0, deferred: 0, failed: 0, blockers: config.blockers };
  if (config.mode === "disabled" || config.blockers.length) return result;
  const started = Date.now();
  for (let index = 0; index < (options.maxMessages ?? 10) && Date.now() - started < (options.deadlineMs ?? 18000); index++) {
    const job = await repository.claim();
    if (!job) break;
    let attempted = false;
    try {
      const snapshot = await repository.snapshot(job);
      const ineligible = chatEmailEligibility(job, snapshot);
      if (ineligible) { await repository.finish(job, "cancelled", ineligible, now()); result.cancelled++; continue; }
      if (!snapshot.allowed) continue;
      // Resend retains idempotency keys for 24h. Never automatically retry beyond that window.
      if (job.first_attempt_at && now().getTime() - Date.parse(job.first_attempt_at) >= 23 * 3600000) {
        await repository.finish(job, "needs_review", "idempotency_window_elapsed", now()); result.failed++; continue;
      }
      if (config.mode === "dry_run") {
        await repository.finish(job, "queued", "dry_run_checked", new Date(now().getTime() + 60000));
        result.previewed++; continue;
      }
      const payload = job.payload ?? renderChatNotification(config, job, snapshot.email);
      const prepared = await repository.prepare(job, payload);
      if (!prepared) { await repository.finish(job, "cancelled", "eligibility_or_lease_changed", now()); result.cancelled++; continue; }
      attempted = true;
      const providerId = await provider.send(prepared, `chat-email:${job.id}`);
      await repository.finish(job, "sent", null, now(), providerId);
      result.sent++;
    } catch (error) {
      const reason = error instanceof EmailDeliveryError ? error.code : attempted ? "delivery_outcome_unknown" : "eligibility_check_failed";
      const retryable = !(error instanceof EmailDeliveryError) || error.retryable;
      const attempts = job.attempts + (attempted ? 1 : 0);
      const status = !retryable ? "failed" : attempts >= 8 ? "needs_review" : "retry";
      const delay = Math.min(3600000, 30000 * 2 ** Math.min(attempts, 7)) + Math.floor((options.random ?? Math.random)() * 10000);
      // A failed acknowledgement leaves the lease to expire; a retry uses the same frozen payload/key.
      try { await repository.finish(job, status, reason, new Date(now().getTime() + delay)); } catch { /* Durable leased job is reclaimable. */ }
      result.failed++;
    }
  }
  return result;
}
