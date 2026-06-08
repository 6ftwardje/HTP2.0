import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/**
 * Server-only Anthropic-client. Vereist ANTHROPIC_API_KEY (nooit NEXT_PUBLIC).
 * Throwt expliciet als de key ontbreekt zodat de helper dat netjes kan loggen.
 */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}
