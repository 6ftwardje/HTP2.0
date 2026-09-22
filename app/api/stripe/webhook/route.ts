import { NextRequest, NextResponse } from "next/server";
import {
  beginStripeEvent,
  finishStripeEvent,
  processStripeEvent,
} from "@/lib/stripe-subscriptions";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe webhook configuration." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const shouldProcess = await beginStripeEvent(event);
    if (!shouldProcess) return NextResponse.json({ received: true });

    await processStripeEvent(event);
    await finishStripeEvent(event.id, { success: true });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe webhook processing", event.id, message);
    try {
      await finishStripeEvent(event.id, { success: false, error: message });
    } catch (finishError) {
      console.error("Stripe webhook receipt update", finishError);
    }
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
