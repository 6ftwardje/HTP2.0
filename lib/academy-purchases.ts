import "server-only";

import type Stripe from "stripe";
import { grantAcademySubscriptionBonus } from "@/lib/billing";
import { createServiceClient } from "@/lib/supabase/service";
import { getAcademyPriceId, getStripe, stripeObjectId } from "@/lib/stripe";

export async function processAcademyCheckout(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.metadata?.product_type !== "academy") {
    return { skipped: true as const };
  }
  if (session.payment_status !== "paid") {
    return { skipped: true as const };
  }

  const studentId = session.client_reference_id ?? session.metadata?.student_id;
  const customerId = stripeObjectId(session.customer);
  const paymentIntentId = stripeObjectId(session.payment_intent);
  if (!studentId || !customerId) {
    throw new Error(`Academy Checkout ${session.id} has no student or customer mapping`);
  }

  const configuredPriceId = getAcademyPriceId();
  const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, {
    limit: 10,
  });
  const academyLine = lineItems.data.find(
    (line) => line.price?.id === configuredPriceId && line.quantity === 1
  );
  if (
    !academyLine ||
    session.currency !== "eur" ||
    session.amount_total !== 200000
  ) {
    throw new Error(`Academy Checkout ${session.id} does not match the configured EUR 2,000 price`);
  }

  const db = createServiceClient();
  const { error: customerError } = await db.from("billing_customers").upsert(
    { student_id: studentId, stripe_customer_id: customerId },
    { onConflict: "student_id" }
  );
  if (customerError) throw new Error(customerError.message);

  const { error: purchaseError } = await db.from("one_time_purchases").upsert(
    {
      student_id: studentId,
      product_key: "academy",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      stripe_price_id: configuredPriceId,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: "paid",
      purchased_at: new Date(session.created * 1000).toISOString(),
      metadata: {
        lifetime_academy_access: true,
        one_on_one_calls: 3,
        subscription_bonus_months: 3,
        subscription_bonus_auto_renews: false,
      },
    },
    { onConflict: "stripe_checkout_session_id" }
  );
  if (purchaseError) throw new Error(purchaseError.message);

  const { error: accessError } = await db
    .from("students")
    .update({ access_level: 2 })
    .eq("id", studentId)
    .lt("access_level", 2);
  if (accessError) throw new Error(accessError.message);

  await grantAcademySubscriptionBonus({
    studentId,
    sourceId: session.id,
    startsAt: new Date(session.created * 1000),
  });

  return { skipped: false as const, studentId };
}
