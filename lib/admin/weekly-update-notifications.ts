import { createClient } from "@/lib/supabase/server";
import type { WeeklyUpdate, WeeklyUpdateAccessTier } from "@/lib/types";
import { getWeeklyUpdateAccessOption } from "@/lib/weekly-update-access";

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
    "id" | "title" | "slug" | "summary" | "access_tier"
  >;
  actorStudentId: string;
}): Promise<{ notified: number; skipped: boolean; error: string | null }> {
  const accessOption = getWeeklyUpdateAccessOption(weeklyUpdate.access_tier);
  if (!accessOption.selectable || accessOption.minAccessLevel === null) {
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

  if (existing.data?.id) {
    return { notified: 0, skipped: true, error: null };
  }

  let studentsQuery = db
    .from("students")
    .select("id")
    .gte("access_level", accessOption.minAccessLevel);

  const students = await studentsQuery;
  if (students.error) {
    return { notified: 0, skipped: false, error: students.error.message };
  }

  const recipients = (students.data ?? [])
    .map((student) => student.id)
    .filter(Boolean);

  if (recipients.length === 0) {
    return { notified: 0, skipped: false, error: null };
  }

  const event = await db
    .from("notification_events")
    .insert({
      type: WEEKLY_UPDATE_PUBLISHED_EVENT_TYPE,
      actor_student_id: actorStudentId,
      target_table: "weekly_updates",
      target_id: targetId,
      title: "Nieuwe weekly update",
      body: weeklyUpdate.title,
      href: `/weekly-updates/${weeklyUpdate.slug}`,
      metadata: {
        access_tier: weeklyUpdate.access_tier,
        access_label: accessOption.label,
        summary: weeklyUpdate.summary,
      },
    })
    .select("id")
    .single();

  if (event.error || !event.data?.id) {
    if (event.error?.code === "23505") {
      return { notified: 0, skipped: true, error: null };
    }
    if (isMissingTable(event.error ?? null)) {
      console.warn("notifyWeeklyUpdatePublished: notification tables missing");
      return { notified: 0, skipped: true, error: null };
    }
    return {
      notified: 0,
      skipped: false,
      error: event.error?.message ?? "Could not create notification event.",
    };
  }

  const recipientRows = recipients.map((studentId) => ({
    event_id: event.data.id,
    student_id: studentId,
  }));

  const inserted = await db
    .from("notification_recipients")
    .upsert(recipientRows, { onConflict: "event_id,student_id" });

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
  return option.selectable && option.minAccessLevel !== null;
}

