import { NextRequest, NextResponse } from "next/server";
import { ensureBillingCustomer, paidProductsEnabled } from "@/lib/billing";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import {
  assertAcademyPriceConfiguration,
  getSiteUrl,
  getStripe,
  getTermsConsentOptions,
} from "@/lib/stripe";
import { ensureCurrentStudent } from "@/lib/students";

export async function POST(request: NextRequest) {
  if (!paidProductsEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  const siteUrl = getSiteUrl();
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 403 });
  }

  const { student, error } = await ensureCurrentStudent();
  if (error || !student) {
    return NextResponse.redirect(`${siteUrl}/?redirectedFrom=%2Faccount`, 303);
  }
  if (student.access_level >= 2) {
    return NextResponse.redirect(`${siteUrl}/account?academy=active`, 303);
  }

  try {
    const academyPriceId = await assertAcademyPriceConfiguration();
    const billingCustomer = await ensureBillingCustomer(student);
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer: billingCustomer.stripe_customer_id,
      client_reference_id: student.id,
      line_items: [{ price: academyPriceId, quantity: 1 }],
      locale: "nl",
      billing_address_collection: "required",
      // Stripe Checkout has no allowlist for billing countries. Requiring an
      // address from this allowlist is the hard Checkout-level sales block.
      shipping_address_collection: { allowed_countries: ["BE", "NL"] },
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      ...getTermsConsentOptions(),
      invoice_creation: { enabled: true },
      payment_intent_data: {
        metadata: { student_id: student.id, product_type: "academy" },
      },
      metadata: { student_id: student.id, product_type: "academy" },
      custom_text: {
        submit: {
          message:
            "€2.000 eenmalig inclusief btw. Inclusief lifetime Academy-toegang, 3 gratis 1-op-1 calls en 3 maanden subscriptionbonus zonder automatische verlenging.",
        },
      },
      success_url: `${siteUrl}/billing/success?product=academy&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/account?billing=cancelled`,
    });

    if (!session.url) throw new Error("Stripe Checkout returned no URL");
    return NextResponse.redirect(session.url, 303);
  } catch (checkoutError) {
    console.error("Academy Checkout", checkoutError);
    return NextResponse.redirect(`${siteUrl}/account?billing=error`, 303);
  }
}
