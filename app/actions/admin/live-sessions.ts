"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";
import type { LiveSession } from "@/lib/types";

const DISPLAY_TIMEZONE = "Europe/Brussels";

function actionError(message: string): never {
  throw new Error(message);
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function selectedMarkets(formData: FormData) {
  const allowed = new Set(["crypto", "forex", "stocks", "commodities", "macro"]);
  return formData.getAll("markets").map(text).filter((value) => allowed.has(value));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function subscriberIds() {
  const db = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("student_entitlements")
    .select("student_id")
    .eq("entitlement_key", "subscriber_content")
    .is("revoked_at", null)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`);
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((row) => row.student_id)));
}

async function notifyLiveSession(
  session: Pick<LiveSession, "id" | "title" | "starts_at" | "cancellation_reason">,
  actorStudentId: string,
  type: "live_session.scheduled" | "live_session.cancelled"
) {
  const db = createServiceClient();
  const targetId = session.id;
  const { data: existing } = await db
    .from("notification_events")
    .select("id")
    .eq("type", type)
    .eq("target_table", "live_sessions")
    .eq("target_id", targetId)
    .maybeSingle();
  if (existing) return;

  const date = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIMEZONE,
  }).format(new Date(session.starts_at));
  const recipients = await subscriberIds();
  if (recipients.length === 0) return;

  const { data: event, error } = await db
    .from("notification_events")
    .insert({
      type,
      actor_student_id: actorStudentId,
      target_table: "live_sessions",
      target_id: targetId,
      title:
        type === "live_session.cancelled"
          ? "Livesessie geannuleerd"
          : "Nieuwe Weekly Outlook gepland",
      body:
        type === "live_session.cancelled"
          ? `${session.title}: ${session.cancellation_reason}`
          : `${session.title} · ${date}`,
      href: "/live-sessions",
      metadata: { starts_at: session.starts_at },
    })
    .select("id")
    .single();
  if (error || !event) throw new Error(error?.message ?? "Melding aanmaken mislukt.");

  const { error: recipientError } = await db.from("notification_recipients").insert(
    recipients.map((studentId) => ({ event_id: event.id, student_id: studentId }))
  );
  if (recipientError) throw new Error(recipientError.message);
}

function revalidateLiveSessions() {
  revalidatePath("/admin/live-sessions");
  revalidatePath("/live-sessions");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function adminCreateLiveSession(
  formData: FormData
): Promise<void> {
  const { actorStudent } = await requireAdmin();
  const title = text(formData.get("title"));
  const slug = slugify(text(formData.get("slug")) || title);
  const description = text(formData.get("description")) || null;
  const localStart = text(formData.get("starts_at"));
  const durationMinutes = Number(text(formData.get("duration_minutes")) || 60);
  const mentorStudentId = text(formData.get("mentor_student_id")) || null;
  const providerEventId = text(formData.get("provider_event_id")) || null;
  const externalJoinUrl = text(formData.get("external_join_url"));
  const publish = formData.get("is_published") === "on";

  if (!title || !slug) actionError("Titel is verplicht.");
  if (!localStart) actionError("Startdatum is verplicht.");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    actionError("Duur moet tussen 15 en 480 minuten liggen.");
  }
  if (publish && !externalJoinUrl) {
    actionError("Een gepubliceerde sessie heeft een deelname-URL nodig.");
  }
  try {
    if (externalJoinUrl && new URL(externalJoinUrl).protocol !== "https:") {
      actionError("De deelname-URL moet HTTPS gebruiken.");
    }
  } catch {
    actionError("De deelname-URL is ongeldig.");
  }

  const startsAt = fromZonedTime(localStart, DISPLAY_TIMEZONE);
  if (Number.isNaN(startsAt.getTime())) {
    actionError("De startdatum is ongeldig.");
  }
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  if (publish && endsAt <= new Date()) {
    actionError("Een gepubliceerde sessie moet in de toekomst eindigen.");
  }
  const db = createServiceClient();
  const { data, error } = await db
    .from("live_sessions")
    .insert({
      title,
      slug,
      description,
      summary: description,
      markets: selectedMarkets(formData),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      display_timezone: DISPLAY_TIMEZONE,
      mentor_student_id: mentorStudentId,
      created_by_student_id: actorStudent.id,
      provider: "clickmeeting",
      provider_event_id: providerEventId,
      status: publish ? "scheduled" : "draft",
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error || !data) actionError(error?.message ?? "Aanmaken mislukt.");

  if (externalJoinUrl) {
    const { error: secretError } = await db.from("live_session_provider_secrets").insert({
      live_session_id: data.id,
      external_join_url: externalJoinUrl,
    });
    if (secretError) {
      await db.from("live_sessions").delete().eq("id", data.id);
      actionError(secretError.message);
    }
  }

  if (publish) await notifyLiveSession(data as LiveSession, actorStudent.id, "live_session.scheduled");
  logAdminAction("live_session.created", {
    actorStudentId: actorStudent.id,
    metadata: { liveSessionId: data.id, title, startsAt: startsAt.toISOString() },
  });
  revalidateLiveSessions();
}

export async function adminSetLiveSessionStatus(
  sessionId: string,
  status: "scheduled" | "live"
): Promise<void> {
  const { actorStudent } = await requireAdmin();
  if (!['scheduled', 'live'].includes(status)) actionError("Ongeldige status.");
  const db = createServiceClient();
  const { data, error } = await db
    .from("live_sessions")
    .update({ status })
    .eq("id", sessionId)
    .eq("is_published", true)
    .in("status", ["scheduled", "live"])
    .select("id")
    .maybeSingle();
  if (error || !data) actionError(error?.message ?? "De status kon niet worden aangepast.");
  logAdminAction("live_session.status_updated", {
    actorStudentId: actorStudent.id,
    metadata: { liveSessionId: sessionId, status },
  });
  revalidateLiveSessions();
}

export async function adminPublishLiveSession(
  sessionId: string,
  formData: FormData
): Promise<void> {
  const { actorStudent } = await requireAdmin();
  const providerEventId = text(formData.get("provider_event_id")) || null;
  const externalJoinUrl = text(formData.get("external_join_url"));
  if (!externalJoinUrl) {
    actionError("Een deelname-URL is verplicht om te publiceren.");
  }
  try {
    if (new URL(externalJoinUrl).protocol !== "https:") {
      actionError("De deelname-URL moet HTTPS gebruiken.");
    }
  } catch {
    actionError("De deelname-URL is ongeldig.");
  }

  const db = createServiceClient();
  const { data: existing, error: existingError } = await db
    .from("live_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (existingError || !existing) {
    actionError(existingError?.message ?? "Sessie niet gevonden.");
  }
  if (["cancelled", "completed"].includes(existing.status)) {
    actionError("Deze sessie kan niet meer gepubliceerd worden.");
  }
  if (new Date(existing.ends_at) <= new Date()) {
    actionError("Een afgelopen sessie kan niet meer gepubliceerd worden.");
  }

  const { error: secretError } = await db
    .from("live_session_provider_secrets")
    .upsert({
      live_session_id: sessionId,
      external_join_url: externalJoinUrl,
    });
  if (secretError) actionError(secretError.message);

  const { data, error } = await db
    .from("live_sessions")
    .update({
      provider_event_id: providerEventId,
      status: "scheduled",
      is_published: true,
      published_at: existing.published_at ?? new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error || !data) {
    actionError(error?.message ?? "Publiceren mislukt.");
  }

  await notifyLiveSession(data as LiveSession, actorStudent.id, "live_session.scheduled");
  logAdminAction("live_session.published", {
    actorStudentId: actorStudent.id,
    metadata: { liveSessionId: sessionId },
  });
  revalidateLiveSessions();
}

export async function adminCancelLiveSession(
  sessionId: string,
  formData: FormData
): Promise<void> {
  const { actorStudent } = await requireAdmin();
  const reason = text(formData.get("cancellation_reason"));
  if (!reason) actionError("Geef een reden voor de annulering.");

  const db = createServiceClient();
  const { data, error } = await db
    .from("live_sessions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error || !data) actionError(error?.message ?? "Annuleren mislukt.");

  if (data.is_published) {
    await notifyLiveSession(data as LiveSession, actorStudent.id, "live_session.cancelled");
  }
  logAdminAction("live_session.cancelled", {
    actorStudentId: actorStudent.id,
    metadata: { liveSessionId: sessionId, reason },
  });
  revalidateLiveSessions();
}

export async function adminAttachLiveSessionReplay(
  sessionId: string,
  formData: FormData
): Promise<void> {
  const { actorStudent } = await requireAdmin();
  const replayId = Number(text(formData.get("replay_weekly_update_id")));
  if (!Number.isInteger(replayId) || replayId <= 0) {
    actionError("Kies een geldige replay.");
  }

  const availableFrom = new Date();
  const availableUntil = new Date(availableFrom.getTime() + 28 * 24 * 60 * 60_000);
  const db = createServiceClient();
  const { data: session, error: sessionError } = await db
    .from("live_sessions")
    .select("status, ends_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session) {
    actionError(sessionError?.message ?? "Sessie niet gevonden.");
  }
  if (session.status === "cancelled") {
    actionError("Aan een geannuleerde sessie kan geen replay worden gekoppeld.");
  }
  if (new Date(session.ends_at) > availableFrom) {
    actionError("Koppel de replay pas nadat de livesessie is afgelopen.");
  }
  const { error } = await db
    .from("live_sessions")
    .update({
      status: "completed",
      replay_weekly_update_id: replayId,
      replay_available_from: availableFrom.toISOString(),
      replay_available_until: availableUntil.toISOString(),
    })
    .eq("id", sessionId);
  if (error) actionError(error.message);

  logAdminAction("live_session.replay_attached", {
    actorStudentId: actorStudent.id,
    metadata: { liveSessionId: sessionId, replayId },
  });
  revalidateLiveSessions();
}
