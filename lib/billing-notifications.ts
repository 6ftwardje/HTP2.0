import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { StudentEntitlement } from "@/lib/types";

async function ensureNotification({
  type,
  targetTable,
  targetId,
  studentId,
  title,
  body,
}: {
  type: string;
  targetTable: string;
  targetId: string;
  studentId: string;
  title: string;
  body: string;
}) {
  const db = createServiceClient();
  const { data: existing } = await db
    .from("notification_events")
    .select("id")
    .eq("type", type)
    .eq("target_table", targetTable)
    .eq("target_id", targetId)
    .maybeSingle();

  let eventId = existing?.id ?? null;
  if (!eventId) {
    const { data: created, error } = await db
      .from("notification_events")
      .insert({
        type,
        target_table: targetTable,
        target_id: targetId,
        title,
        body,
        href: "/account#subscription",
      })
      .select("id")
      .single();
    if (error || !created) {
      // A concurrent request may already have inserted the idempotent event.
      if (error?.code !== "23505") throw new Error(error?.message ?? "Melding aanmaken mislukt.");
      const { data: concurrent, error: concurrentError } = await db
        .from("notification_events")
        .select("id")
        .eq("type", type)
        .eq("target_table", targetTable)
        .eq("target_id", targetId)
        .single();
      if (concurrentError || !concurrent) {
        throw new Error(concurrentError?.message ?? "Melding terugvinden mislukt.");
      }
      eventId = concurrent.id;
    } else {
      eventId = created.id;
    }
  }

  const { error: recipientError } = await db
    .from("notification_recipients")
    .upsert(
      { event_id: eventId, student_id: studentId },
      { onConflict: "event_id,student_id" }
    );
  if (recipientError) throw new Error(recipientError.message);
}

export async function notifyBonusExpired(entitlement: StudentEntitlement) {
  await ensureNotification({
    type: "subscription.bonus_expired",
    targetTable: "student_entitlements",
    targetId: entitlement.id,
    studentId: entitlement.student_id,
    title: "Je gratis subscriptiontoegang is verlopen",
    body: "Marktupdates en livesessies zijn nu vergrendeld. Je kiest zelf of je verdergaat voor €99 per maand, inclusief btw.",
  });
}

export async function notifyPaymentFailed({
  studentId,
  invoiceId,
}: {
  studentId: string;
  invoiceId: string;
}) {
  await ensureNotification({
    type: "subscription.payment_failed",
    targetTable: "stripe_invoices",
    targetId: invoiceId,
    studentId,
    title: "Betaling van je subscription mislukt",
    body: "Je toegang is onmiddellijk gepauzeerd. Werk je betaalmethode bij om de marktupdates en livesessies opnieuw te openen.",
  });
}
