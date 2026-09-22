import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 10_000,
      appInfo: {
        name: "Het Trade Platform",
        version: "2.0",
      },
    });
  }

  return stripeClient;
}

export function getSubscriptionPriceId() {
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  if (!priceId) throw new Error("Missing STRIPE_SUBSCRIPTION_PRICE_ID");
  return priceId;
}

export function getAcademyPriceId() {
  const priceId = process.env.STRIPE_ACADEMY_PRICE_ID;
  if (!priceId) throw new Error("Missing STRIPE_ACADEMY_PRICE_ID");
  return priceId;
}

export async function assertSubscriptionPriceConfiguration() {
  const priceId = getSubscriptionPriceId();
  const price = await getStripe().prices.retrieve(priceId);
  const valid =
    price.active &&
    price.currency === "eur" &&
    price.unit_amount === 9900 &&
    price.type === "recurring" &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1 &&
    price.tax_behavior === "inclusive";

  if (!valid) {
    throw new Error(
      "Stripe subscription price must be active, EUR 99/month, and tax-inclusive"
    );
  }
  return priceId;
}

export async function assertAcademyPriceConfiguration() {
  const priceId = getAcademyPriceId();
  const price = await getStripe().prices.retrieve(priceId);
  const valid =
    price.active &&
    price.currency === "eur" &&
    price.unit_amount === 200000 &&
    price.type === "one_time" &&
    price.tax_behavior === "inclusive";

  if (!valid) {
    throw new Error(
      "Stripe Academy price must be active, EUR 2,000 one-time, and tax-inclusive"
    );
  }
  return priceId;
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

export function getTermsConsentOptions() {
  return process.env.STRIPE_COLLECT_TERMS_OF_SERVICE === "true"
    ? ({ consent_collection: { terms_of_service: "required" as const } } as const)
    : {};
}

export function unixToIso(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

export function stripeObjectId(
  value: string | { id: string } | null | undefined
) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}
