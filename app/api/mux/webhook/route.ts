import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logError } from "@/lib/logger";
import { unwrapMuxCaptionEvent } from "@/lib/transcription/mux-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    logError("mux.webhook.missing_configuration", new Error("MUX_WEBHOOK_SECRET missing"));
    return NextResponse.json({ error: "Webhook is niet geconfigureerd." }, { status: 503 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = await unwrapMuxCaptionEvent(rawBody, request.headers, secret);
  } catch (error) {
    // Never log the body, signature, transcript text or provider identifiers.
    logError("mux.webhook.invalid_signature_or_payload", error);
    return NextResponse.json({ error: "Ongeldig webhookverzoek." }, { status: 401 });
  }

  if (!event) return NextResponse.json({ received: true, relevant: false });

  const db = createServiceClient();
  const { data, error } = await db.rpc("process_mux_caption_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_asset_id: event.assetId,
    p_track_id: event.trackId,
    p_language_code: event.languageCode,
    p_error_code: event.errorCode,
  });

  if (error) {
    logError("mux.webhook.processing_failed", error, { eventType: event.type });
    // A 500 asks Mux to retry. No raw payload or identifiers are logged.
    return NextResponse.json({ error: "Webhookverwerking mislukt." }, { status: 500 });
  }

  return NextResponse.json({ received: true, duplicate: data === "duplicate" });
}
