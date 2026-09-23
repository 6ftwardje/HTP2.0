export const WORKFLOW_MAX_ATTEMPTS = 4;

export type WorkflowStep = "fetch_transcript" | "enrich" | "review" | "complete";
export type WorkflowStatus =
  | "pending"
  | "running"
  | "waiting_review"
  | "completed"
  | "failed"
  | "dead_letter";

export function leaseIsAvailable(input: {
  status: WorkflowStatus;
  attemptCount: number;
  maxAttempts?: number;
  leaseExpiresAt?: string | null;
  nextAttemptAt?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? WORKFLOW_MAX_ATTEMPTS;
  if (input.attemptCount >= maxAttempts) return false;
  if (!["pending", "failed", "running"].includes(input.status)) return false;
  if (input.nextAttemptAt && new Date(input.nextAttemptAt) > now) return false;
  return !input.leaseExpiresAt || new Date(input.leaseExpiresAt) <= now;
}

export function retryDelaySeconds(attemptCount: number) {
  const schedule = [60, 300, 1_800] as const;
  return schedule[Math.min(Math.max(attemptCount - 1, 0), schedule.length - 1)];
}

export function failureTransition(input: {
  attemptCount: number;
  maxAttempts?: number;
  retryable: boolean;
  now?: Date;
}): { status: "failed" | "dead_letter"; nextAttemptAt: string | null } {
  const maxAttempts = input.maxAttempts ?? WORKFLOW_MAX_ATTEMPTS;
  if (!input.retryable || input.attemptCount >= maxAttempts) {
    return { status: "dead_letter", nextAttemptAt: null };
  }
  const now = input.now ?? new Date();
  return {
    status: "failed",
    nextAttemptAt: new Date(
      now.getTime() + retryDelaySeconds(input.attemptCount) * 1_000
    ).toISOString(),
  };
}

export function nextWorkflowStep(input: {
  transcriptStatus: string;
  hasEnrichment: boolean;
  enrichmentStatus?: string | null;
}): WorkflowStep {
  if (input.transcriptStatus !== "ready") return "fetch_transcript";
  if (!input.hasEnrichment) return "enrich";
  if (["draft", "review"].includes(input.enrichmentStatus ?? "")) return "review";
  if (input.enrichmentStatus === "published") return "complete";
  return "enrich";
}
