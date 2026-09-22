import { NextRequest, NextResponse } from "next/server";
import {
  ensureBillingCustomer,
  getBillingOverview,
  subscriptionNeedsManagement,
} from "@/lib/billing";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import {
  assertSubscriptionPriceConfiguration,
  getSiteUrl,
  getStripe,
  getTermsConsentOptions,
} from "@/lib/stripe";
import { ensureCurrentStudent } from "@/lib/students";

export async function POST(request: NextRequest) {
  const siteUrl = getSiteUrl();
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 403 });
  }

  const { student, error } = await ensureCurrentStudent();
  if (error || !student) {
    return NextResponse.redirect(`${siteUrl}/?redirectedFrom=%2Faccount`, 303);
  }

  try {
    const overview = await getBillingOverview(student.id);
    const billingCustomer = await ensureBillingCustomer(student);
    const stripe = getStripe();
    const subscriptionPriceId = await assertSubscriptionPriceConfiguration();

    if (subscriptionNeedsManagement(overview.subscription)) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: billingCustomer.stripe_customer_id,
        return_url: `${siteUrl}/account`,
      });
      return NextResponse.redirect(portal.url, 303);
    }

    // Check Stripe as well as the local projection to close the small window
    // between Checkout completion and webhook delivery.
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: billingCustomer.stripe_customer_id,
      status: "all",
      limit: 20,
    });
    const existing = stripeSubscriptions.data.find((subscription) =>
      ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(
        subscription.status
      )
    );
    if (existing) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: billingCustomer.stripe_customer_id,
        return_url: `${siteUrl}/account`,
      });
      return NextResponse.redirect(portal.url, 303);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: billingCustomer.stripe_customer_id,
      client_reference_id: student.id,
      line_items: [{ price: subscriptionPriceId, quantity: 1 }],
      locale: "nl",
      billing_address_collection: "required",
      // Stripe Checkout has no allowlist for billing countries. Requiring an
      // address from this allowlist is the hard Checkout-level sales block.
      shipping_address_collection: { allowed_countries: ["BE", "NL"] },
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      ...getTermsConsentOptions(),
      subscription_data: {
        metadata: {
          student_id: student.id,
          entitlement_key: "subscriber_content",
        },
      },
      metadata: {
        student_id: student.id,
        entitlement_key: "subscriber_content",
      },
      custom_text: {
        submit: {
          message:
            "€99 per maand inclusief btw. Je kunt opzeggen tegen het einde van de lopende betaalperiode.",
        },
      },
      success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/account?billing=cancelled`,
    });

    if (!session.url) throw new Error("Stripe Checkout returned no URL");
    return NextResponse.redirect(session.url, 303);
  } catch (checkoutError) {
    console.error("billing checkout", checkoutError);
    return NextResponse.redirect(`${siteUrl}/account?billing=error`, 303);
  }
}
