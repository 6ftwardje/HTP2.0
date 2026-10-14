export type EmailPayload = {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  tags: { name: string; value: string }[];
};
export type EmailProvider = { send(payload: EmailPayload, idempotencyKey: string): Promise<string> };
export class EmailDeliveryError extends Error {
  constructor(public code: string, public retryable: boolean) { super(code); }
}
