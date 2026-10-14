import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { createChatResendProvider } from "./resend";
import { readChatEmailConfig, type ChatEmailJob, type ChatEmailSnapshot } from "./policy";
import { runChatEmailBatch, type ChatEmailRepository } from "./worker";
import type { EmailPayload } from "./types";
import { cleanupChatAttachments } from "@/lib/chat-attachments-server";

type DB = ReturnType<typeof createServiceClient>;
async function rpc<T>(db: DB, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error("chat_notification_database_failed");
  return data as T;
}

export function chatEmailRepository(db: DB): ChatEmailRepository {
  return {
    claim: async () => (await rpc<ChatEmailJob[]>(db, "claim_chat_email_notification"))[0] ?? null,
    snapshot: (job) => rpc<ChatEmailSnapshot>(db, "chat_email_recipient_snapshot", { p_id: job.id }),
    prepare: (job, payload) => rpc<EmailPayload | null>(db, "prepare_chat_email_send", { p_id: job.id, p_lease: job.lease_token, p_payload: payload }),
    async finish(job, status, reason, dueAt, providerId) {
      const finished = await rpc<boolean>(db, "finish_chat_email_notification", {
        p_id: job.id, p_lease: job.lease_token, p_status: status, p_reason: reason,
        p_due_at: dueAt.toISOString(), p_provider_id: providerId ?? null,
      });
      if (!finished) throw new Error("chat_notification_lease_changed");
    },
  };
}

export async function runChatNotificationWorker() {
  const config = readChatEmailConfig();
  // Disabled/incomplete deployments neither instantiate a privileged DB client nor claim work.
  if (config.mode === "disabled" || config.blockers.length) return {
    mode: config.mode, sent: 0, previewed: 0, cancelled: 0, deferred: 0, failed: 0, blockers: config.blockers,
  };
  const db = createServiceClient();
  return runChatEmailBatch(config, chatEmailRepository(db), createChatResendProvider(config));
}

export async function runChatMaintenance() {
  const email = await runChatNotificationWorker();
  const attachments = process.env.CHAT_MAINTENANCE_ENABLED === "true"
    ? await cleanupChatAttachments(createServiceClient())
    : { removed: 0 };
  return { email, attachments };
}
