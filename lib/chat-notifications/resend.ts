import { EmailDeliveryError, type EmailProvider } from "./types";
import type { ChatEmailConfig } from "./policy";

/** Transactional chat transport; each call independently enforces technical config. */
export function createChatResendProvider(config: ChatEmailConfig, request: typeof fetch = fetch): EmailProvider {
  return { async send(payload, idempotencyKey) {
    if (config.mode !== "live" || config.blockers.length) throw new EmailDeliveryError("delivery_disabled", false);
    let response: Response;
    try {
      response = await request("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${config.email.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ ...payload, replyTo: undefined, reply_to: payload.replyTo }),
      });
    } catch { throw new EmailDeliveryError("resend_outcome_unknown", true); }
    if (!response.ok) {
      let busy = false;
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        busy = body?.name === "concurrent_idempotent_requests";
      }
      // Provider error bodies and recipient addresses are never logged or persisted.
      throw new EmailDeliveryError(`resend_http_${response.status}`, response.status === 429 || response.status >= 500 || busy);
    }
    const body = await response.json().catch(() => null);
    if (typeof body?.id !== "string") throw new EmailDeliveryError("resend_outcome_unknown", true);
    return body.id;
  } };
}
