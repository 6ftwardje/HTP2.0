import "server-only";

import type Stripe from "stripe";
import { processAcademyCheckout } from "@/lib/academy-purchases";
import { SUBSCRIBER_CONTENT_ENTITLEMENT } from "@/lib/billing";
import { notifyPaymentFailed } from "@/lib/billing-notifications";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getStripe,
  getSubscriptionPriceId,
  stripeObjectId,
  unixToIso,
} from "@/lib/stripe";
import type { SubscriptionStatus } from "@/lib/types";

const ACCESS_STATUSES = new Set<SubscriptionStatus>(["active", "trialing"]);

function subscriptionPeriod(subscription: Stripe.Subscription, priceId: string) {
  const item =
    subscription.items.data.find((candidate) => candidate.price.id === priceId) ??
    subscription.items.data[0] ??
    null;

  return {
    priceId: item?.price.id ?? priceId,
    start: unixToIso(item?.current_period_start),
    end: unixToIso(item?.current_period_end),
  };
}

async function findStudentId(
  subscription: Stripe.Subscription,
  explicitStudentId?: string | null
) {
  if (explicitStudentId) return explicitStudentId;
  if (subscription.metadata.student_id) return subscription.metadata.student_id;

  const customerId = stripeObjectId(subscription.customer);
  if (!customerId) return null;

  const db = createServiceClient();
  const { data, error } = await db
    .from("billing_customers")
    .select("student_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.student_id ?? null;
}

export async function syncStripeSubscription({
  subscription,
  eventCreated,
  explicitStudentId,
  forcePastDue = false,
}: {
  subscription: Stripe.Subscription;
  eventCreated: number;
  explicitStudentId?: string | null;
  forcePastDue?: boolean;
}) {
  const configuredPriceId = getSubscriptionPriceId();
  const period = subscriptionPeriod(subscription, configuredPriceId);
  const isSubscriberProduct =
    period.priceId === configuredPriceId ||
    subscription.metadata.entitlement_key === SUBSCRIBER_CONTENT_ENTITLEMENT;

  if (!isSubscriberProduct) return { skipped: true as const };

  const studentId = await findStudentId(subscription, explicitStudentId);
  if (!studentId) {
    throw new Error(
      `No student mapping for Stripe subscription ${subscription.id}`
    );
  }

  const customerId = stripeObjectId(subscription.customer);
  if (!customerId) throw new Error("Stripe subscription has no customer ID");

  const db = createServiceClient();
  const { data: existing } = await db
    .from("subscriptions")
    .select("last_stripe_event_created_at")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  const priorEventTime = existing?.last_stripe_event_created_at
    ? new Date(existing.last_stripe_event_created_at).getTime()
    : 0;
  const incomingEventTime = eventCreated * 1000;
  if (priorEventTime > incomingEventTime) {
    return {
      skipped: false as const,
      stale: true as const,
      studentId,
      accessIsActive: null,
    };
  }
  const lastEventCreatedAt = new Date(
    Math.max(priorEventTime, incomingEventTime)
  ).toISOString();

  const latestInvoiceId = stripeObjectId(subscription.latest_invoice);
  const status = forcePastDue
    ? ("past_due" as const)
    : (subscription.status as SubscriptionStatus);

  const { error: customerError } = await db.from("billing_customers").upsert(
    {
      student_id: studentId,
      stripe_customer_id: customerId,
    },
    { onConflict: "student_id" }
  );
  if (customerError) throw new Error(customerError.message);

  const { error: subscriptionError } = await db.from("subscriptions").upsert(
    {
      student_id: studentId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      stripe_price_id: period.priceId,
      status,
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: unixToIso(subscription.cancel_at),
      canceled_at: unixToIso(subscription.canceled_at),
      ended_at: unixToIso(subscription.ended_at),
      trial_end: unixToIso(subscription.trial_end),
      latest_invoice_id: latestInvoiceId,
      last_stripe_event_created_at: lastEventCreatedAt,
    },
    { onConflict: "stripe_subscription_id" }
  );
  if (subscriptionError) throw new Error(subscriptionError.message);

  const accessIsActive =
    ACCESS_STATUSES.has(status) &&
    !subscription.pause_collection &&
    (!period.end || new Date(period.end) > new Date());

  const entitlement = {
    student_id: studentId,
    entitlement_key: SUBSCRIBER_CONTENT_ENTITLEMENT,
    source_type: "stripe_subscription",
    source_id: subscription.id,
    starts_at: period.start ?? new Date(subscription.created * 1000).toISOString(),
    ends_at: period.end,
    revoked_at: accessIsActive ? null : new Date().toISOString(),
    metadata: {
      stripe_price_id: period.priceId,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
  };

  const { error: entitlementError } = await db
    .from("student_entitlements")
    .upsert(entitlement, {
      onConflict: "student_id,entitlement_key,source_type,source_id",
    });
  if (entitlementError) throw new Error(entitlementError.message);

  return { skipped: false as const, studentId, accessIsActive };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return stripeObjectId(subscription);
}

export async function processStripeEvent(event: Stripe.Event) {
  const stripe = getStripe();

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "payment" && session.metadata?.product_type === "academy") {
      await processAcademyCheckout(session);
      return;
    }
    const studentId = session.client_reference_id ?? session.metadata?.student_id;
    const customerId = stripeObjectId(session.customer);

    if (studentId && customerId) {
      const db = createServiceClient();
      const { error } = await db.from("billing_customers").upsert(
        { student_id: studentId, stripe_customer_id: customerId },
        { onConflict: "student_id" }
      );
      if (error) throw new Error(error.message);
    }

    const subscriptionId = stripeObjectId(session.subscription);
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncStripeSubscription({
        subscription,
        eventCreated: event.created,
        explicitStudentId: studentId,
      });
    }
    return;
  }

  if (event.type.startsWith("customer.subscription.")) {
    const eventSubscription = event.data.object as Stripe.Subscription;
    let subscription = eventSubscription;
    try {
      subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
    } catch (error) {
      if (event.type !== "customer.subscription.deleted") throw error;
    }

    await syncStripeSubscription({ subscription, eventCreated: event.created });
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const result = await syncStripeSubscription({
      subscription,
      eventCreated: event.created,
      forcePastDue: event.type === "invoice.payment_failed",
    });
    if (
      event.type === "invoice.payment_failed" &&
      !result.skipped &&
      !("stale" in result && result.stale)
    ) {
      await notifyPaymentFailed({
        studentId: result.studentId,
        invoiceId: invoice.id,
      });
    }
  }
}

export async function beginStripeEvent(event: Stripe.Event) {
  const db = createServiceClient();
  const { data: existing, error: selectError } = await db
    .from("stripe_webhook_events")
    .select("processing_status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (selectError) throw new Error(selectError.message);
  if (existing?.processing_status === "completed") return false;

  const { error } = await db.from("stripe_webhook_events").upsert(
    {
      stripe_event_id: event.id,
      event_type: event.type,
      event_created_at: new Date(event.created * 1000).toISOString(),
      processing_status: "processing",
      processed_at: null,
      error_message: null,
    },
    { onConflict: "stripe_event_id" }
  );
  if (error) throw new Error(error.message);
  return true;
}

export async function finishStripeEvent(
  eventId: string,
  result: { success: true } | { success: false; error: string }
) {
  const db = createServiceClient();
  const { error } = await db
    .from("stripe_webhook_events")
    .update({
      processing_status: result.success ? "completed" : "failed",
      processed_at: result.success ? new Date().toISOString() : null,
      error_message: result.success ? null : result.error.slice(0, 2000),
    })
    .eq("stripe_event_id", eventId);
  if (error) throw new Error(error.message);
}
