import { NextRequest, NextResponse } from "next/server";
import { getBillingCustomer, paidProductsEnabled } from "@/lib/billing";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { getSiteUrl, getStripe } from "@/lib/stripe";
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

  try {
    const billingCustomer = await getBillingCustomer(student.id);
    if (!billingCustomer) {
      return NextResponse.redirect(`${siteUrl}/account?billing=not-found`, 303);
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: billingCustomer.stripe_customer_id,
      return_url: `${siteUrl}/account`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (portalError) {
    console.error("billing portal", portalError);
    return NextResponse.redirect(`${siteUrl}/account?billing=error`, 303);
  }
}
