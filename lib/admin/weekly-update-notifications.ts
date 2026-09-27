import { createClient } from "@/lib/supabase/server";
import { paidProductsEnabled } from "@/lib/billing";
import type { WeeklyUpdate, WeeklyUpdateAccessTier } from "@/lib/types";
import {
  getWeeklyUpdateAccessLabel,
  getWeeklyUpdateAccessOption,
  getWeeklyUpdateNotificationAudience,
} from "@/lib/weekly-update-access";

const WEEKLY_UPDATE_PUBLISHED_EVENT_TYPE = "weekly_update.published";

function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("does not exist");
}

export async function notifyWeeklyUpdatePublished({
  weeklyUpdate,
  actorStudentId,
}: {
  weeklyUpdate: Pick<
    WeeklyUpdate,
    | "id"
    | "title"
    | "slug"
    | "summary"
    | "access_tier"
    | "type"
    | "market"
    | "content_format"
  >;
  actorStudentId: string;
}): Promise<{ notified: number; skipped: boolean; error: string | null }> {
  const paidProductsActive = paidProductsEnabled();
  const audience = getWeeklyUpdateNotificationAudience(weeklyUpdate.access_tier, paidProductsActive);
  if (!audience) {
    return { notified: 0, skipped: true, error: null };
  }

  const db = await createClient();
  const targetId = String(weeklyUpdate.id);
  const existing = await db
    .from("notification_events")
    .select("id")
    .eq("type", WEEKLY_UPDATE_PUBLISHED_EVENT_TYPE)
    .eq("target_table", "weekly_updates")
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing.error) {
    if (isMissingTable(existing.error)) {
      console.warn("notifyWeeklyUpdatePublished: notification tables missing");
      return { notified: 0, skipped: true, error: null };
    }
    return { notified: 0, skipped: false, error: existing.error.message };
  }

  let recipients: string[] = [];
  if (audience.kind === "entitlement") {
    const now = new Date().toISOString();
    const entitlements = await db
      .from("student_entitlements")
      .select("student_id")
      .eq("entitlement_key", audience.key)
      .is("revoked_at", null)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`);
    if (entitlements.error) {
      return { notified: 0, skipped: false, error: entitlements.error.message };
    }
    recipients = Array.from(
      new Set((entitlements.data ?? []).map((row) => row.student_id).filter(Boolean))
    );
  } else {
    const students = await db
      .from("students")
      .select("id")
      .gte("access_level", audience.minAccessLevel);
    if (students.error) {
      return { notified: 0, skipped: false, error: students.error.message };
    }
    recipients = (students.data ?? []).map((student) => student.id).filter(Boolean);
  }

  if (recipients.length === 0) {
    return { notified: 0, skipped: false, error: null };
  }

  let eventId = existing.data?.id ?? null;
  if (!eventId) {
    const event = await db
      .from("notification_events")
      .insert({
        type: WEEKLY_UPDATE_PUBLISHED_EVENT_TYPE,
        actor_student_id: actorStudentId,
        target_table: "weekly_updates",
        target_id: targetId,
        title:
          weeklyUpdate.type === "weekly_outlook"
            ? "Nieuwe weekvooruitblik"
            : "Nieuw marktinzicht",
        body: weeklyUpdate.title,
        href: `/market-analysis/${weeklyUpdate.slug}`,
        metadata: {
          type: weeklyUpdate.type,
          market: weeklyUpdate.market,
          access_tier: weeklyUpdate.access_tier,
          access_label: getWeeklyUpdateAccessLabel(weeklyUpdate.access_tier, paidProductsActive),
          summary: weeklyUpdate.summary,
        },
      })
      .select("id")
      .single();

    if (event.error?.code === "23505") {
      const retry = await db
        .from("notification_events")
        .select("id")
        .eq("type", WEEKLY_UPDATE_PUBLISHED_EVENT_TYPE)
        .eq("target_table", "weekly_updates")
        .eq("target_id", targetId)
        .maybeSingle();
      if (retry.error || !retry.data?.id) {
        return { notified: 0, skipped: false, error: retry.error?.message ?? "Melding kon niet worden opgehaald." };
      }
      eventId = retry.data.id;
    } else if (event.error || !event.data?.id) {
      if (isMissingTable(event.error ?? null)) {
        console.warn("notifyWeeklyUpdatePublished: notification tables missing");
        return { notified: 0, skipped: true, error: null };
      }
      return { notified: 0, skipped: false, error: event.error?.message ?? "Melding aanmaken mislukt." };
    } else {
      eventId = event.data.id;
    }
  }

  const recipientRows = recipients.map((studentId) => ({
    event_id: eventId,
    student_id: studentId,
  }));

  const inserted = await db
    .from("notification_recipients")
    .upsert(recipientRows, {
      onConflict: "event_id,student_id",
      ignoreDuplicates: true,
    });

  if (inserted.error) {
    if (isMissingTable(inserted.error)) {
      console.warn("notifyWeeklyUpdatePublished: notification tables missing");
      return { notified: 0, skipped: true, error: null };
    }
    return { notified: 0, skipped: false, error: inserted.error.message };
  }

  return { notified: recipientRows.length, skipped: false, error: null };
}

export function isWeeklyUpdateNotificationTarget(
  accessTier: WeeklyUpdateAccessTier
) {
  const option = getWeeklyUpdateAccessOption(accessTier);
  return option.selectable;
}
