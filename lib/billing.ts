import { createClient } from "@/lib/supabase/server";
import { notifyBonusExpired } from "@/lib/billing-notifications";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import type {
  BillingCustomer,
  Student,
  StudentEntitlement,
  Subscription,
} from "@/lib/types";

export const SUBSCRIBER_CONTENT_ENTITLEMENT = "subscriber_content";

const ACCESS_STATUSES = new Set(["active", "trialing"]);
const MANAGEABLE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
]);

export type BillingOverview = {
  subscription: Subscription | null;
  entitlement: StudentEntitlement | null;
  expiredBonus: StudentEntitlement | null;
  hasAccess: boolean;
  accessSource: "subscription" | "academy_bonus" | "legacy_bonus" | null;
};

export function isEntitlementActive(
  entitlement: Pick<StudentEntitlement, "starts_at" | "ends_at" | "revoked_at">,
  now = new Date()
) {
  if (entitlement.revoked_at) return false;
  if (new Date(entitlement.starts_at) > now) return false;
  return !entitlement.ends_at || new Date(entitlement.ends_at) > now;
}

export function subscriptionProvidesAccess(
  subscription: Pick<Subscription, "status" | "current_period_end">,
  now = new Date()
) {
  if (!ACCESS_STATUSES.has(subscription.status)) return false;
  return (
    !subscription.current_period_end ||
    new Date(subscription.current_period_end) > now
  );
}

export function subscriptionNeedsManagement(
  subscription: Pick<Subscription, "status"> | null
) {
  return Boolean(subscription && MANAGEABLE_STATUSES.has(subscription.status));
}

export function canAccessSubscriberContent(
  student: Pick<Student, "access_level">,
  overview: Pick<BillingOverview, "hasAccess">
) {
  return student.access_level === 3 || overview.hasAccess;
}

export async function getBillingOverview(
  studentId: string
): Promise<BillingOverview> {
  const db = await createClient();
  const now = new Date();

  const [subscriptionResult, entitlementResult] = await Promise.all([
    db
      .from("subscriptions")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("student_entitlements")
      .select("*")
      .eq("student_id", studentId)
      .eq("entitlement_key", SUBSCRIBER_CONTENT_ENTITLEMENT)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (subscriptionResult.error) {
    console.error("getBillingOverview subscription", subscriptionResult.error.message);
  }
  if (entitlementResult.error) {
    console.error("getBillingOverview entitlement", entitlementResult.error.message);
  }

  const subscription = (subscriptionResult.data as Subscription | null) ?? null;
  const entitlements =
    (entitlementResult.data as StudentEntitlement[] | null) ?? [];
  const entitlement =
    entitlements.find((candidate) => isEntitlementActive(candidate, now)) ?? null;
  const expiredBonus =
    entitlements.find(
      (candidate) =>
        ["academy_bonus", "legacy_academy_bonus"].includes(
          candidate.source_type
        ) &&
        Boolean(candidate.ends_at) &&
        new Date(candidate.ends_at as string) <= now
    ) ?? null;
  const hasAccess = Boolean(entitlement);

  if (expiredBonus && !hasAccess) {
    try {
      await notifyBonusExpired(expiredBonus);
    } catch (error) {
      console.error("notifyBonusExpired", error);
    }
  }

  const accessSource = !entitlement
    ? null
    : entitlement.source_type === "stripe_subscription"
      ? "subscription"
      : entitlement.source_type === "legacy_academy_bonus"
        ? "legacy_bonus"
        : "academy_bonus";

  return { subscription, entitlement, expiredBonus, hasAccess, accessSource };
}

export async function getBillingCustomer(studentId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("billing_customers")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BillingCustomer | null) ?? null;
}

export async function ensureBillingCustomer(
  student: Pick<Student, "id" | "email" | "name">
) {
  const existing = await getBillingCustomer(student.id);
  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create(
    {
      email: student.email,
      name: student.name ?? undefined,
      metadata: { student_id: student.id },
    },
    { idempotencyKey: `billing-customer-${student.id}` }
  );

  const db = createServiceClient();
  const { data, error } = await db
    .from("billing_customers")
    .upsert(
      {
        student_id: student.id,
        stripe_customer_id: customer.id,
      },
      { onConflict: "student_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as BillingCustomer;
}

/** Grants the non-renewing three-month bonus for a new Academy purchase. */
export async function grantAcademySubscriptionBonus({
  studentId,
  sourceId,
  startsAt = new Date(),
}: {
  studentId: string;
  sourceId: string;
  startsAt?: Date;
}) {
  const endsAt = new Date(startsAt);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + 3);

  const db = createServiceClient();
  const { error } = await db.from("student_entitlements").upsert(
    {
      student_id: studentId,
      entitlement_key: SUBSCRIBER_CONTENT_ENTITLEMENT,
      source_type: "academy_bonus",
      source_id: sourceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      revoked_at: null,
      metadata: {
        months: 3,
        renews_automatically: false,
        reason: "academy_purchase_bonus",
      },
    },
    {
      onConflict: "student_id,entitlement_key,source_type,source_id",
    }
  );

  if (error) throw new Error(error.message);
}
