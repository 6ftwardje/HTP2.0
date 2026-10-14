export type ChatEmailConfig = ReturnType<typeof readChatEmailConfig>;
export function readChatEmailConfig(env: Record<string, string | undefined> = process.env) {
  const mode: "disabled" | "dry_run" | "live" = env.CHAT_EMAIL_MODE === "live" || env.CHAT_EMAIL_MODE === "dry_run" ? env.CHAT_EMAIL_MODE : "disabled";
  // Reuse sender settings, while chat preferences stay separate from marketing consent.
  const email = { apiKey: env.RESEND_API_KEY ?? "", from: env.EMAIL_FROM ?? "", replyTo: env.EMAIL_REPLY_TO ?? "", siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "" };
  const blockers: string[] = [];
  if (!email.apiKey.trim()) blockers.push("missing_resend_key");
  const validAddress = (value: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
  const fromAddress = email.from.match(/<([^<>]+)>$/)?.[1] ?? email.from;
  if (/[\r\n]/.test(email.from) || !validAddress(fromAddress.trim())) blockers.push("invalid_sender");
  if (/[\r\n]/.test(email.replyTo) || !validAddress(email.replyTo.trim())) blockers.push("invalid_reply_to");
  try {
    const url = new URL(email.siteUrl);
    if (url.protocol !== "https:" || url.username || url.password) blockers.push("https_site_required");
  } catch { blockers.push("https_site_required"); }
  if (!env.CHAT_MAINTENANCE_SECRET || env.CHAT_MAINTENANCE_SECRET.length < 32) blockers.push("missing_worker_secret");
  return { mode, email, blockers };
}

export type ChatEmailJob = {
  id: string;
  thread_id: string;
  recipient_student_id: string;
  recipient_role: "student" | "mentor";
  mentor_student_id: string;
  last_public_seq: number;
  lease_token: string;
  attempts: number;
  first_attempt_at: string | null;
  payload: import("./types").EmailPayload | null;
};
export type ChatEmailSnapshot =
  | { allowed: false; reason: string }
  | { allowed: true; email: string; recipientStudentId: string; recipientRole: "student" | "mentor"; mentorStudentId: string; threadId: string; lastReadSeq: number; lastPublicSeq: number };

export function chatEmailEligibility(job: ChatEmailJob, snapshot: ChatEmailSnapshot) {
  if (!snapshot.allowed) return snapshot.reason;
  if (snapshot.recipientStudentId !== job.recipient_student_id || snapshot.recipientRole !== job.recipient_role || snapshot.threadId !== job.thread_id || snapshot.mentorStudentId !== job.mentor_student_id) return "recipient_changed";
  if (!snapshot.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(snapshot.email)) return "email_unavailable";
  if (snapshot.lastReadSeq >= job.last_public_seq) return "already_read";
  if (snapshot.lastPublicSeq < job.last_public_seq) return "message_unavailable";
  if (job.payload && job.payload.to.toLowerCase() !== snapshot.email.toLowerCase()) return "email_changed";
  return null;
}
