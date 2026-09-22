import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { paidProductsEnabled } from "@/lib/billing";
import type { LiveSessionWithMentor } from "@/lib/types";

const LIVE_SESSION_SELECT = `
  *,
  mentor:students!live_sessions_mentor_student_id_fkey (
    id,
    name,
    email
  ),
  replay:weekly_updates!live_sessions_replay_weekly_update_id_fkey (
    id,
    title,
    slug
  )
`;

async function contentClient() {
  return paidProductsEnabled() ? await createClient() : createServiceClient();
}

export async function listUpcomingLiveSessions(limit = 6) {
  const db = await contentClient();
  const { data, error } = await db
    .from("live_sessions")
    .select(LIVE_SESSION_SELECT)
    .eq("is_published", true)
    .in("status", ["scheduled", "live"])
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("listUpcomingLiveSessions", error.message);
    return [];
  }
  return (data ?? []) as LiveSessionWithMentor[];
}

export async function listPastLiveSessions(limit = 24) {
  const db = await contentClient();
  const { data, error } = await db
    .from("live_sessions")
    .select(LIVE_SESSION_SELECT)
    .eq("is_published", true)
    .in("status", ["completed", "cancelled"])
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listPastLiveSessions", error.message);
    return [];
  }
  return (data ?? []) as LiveSessionWithMentor[];
}

export function liveSessionJoinState(
  session: Pick<LiveSessionWithMentor, "starts_at" | "ends_at" | "status">,
  now = new Date()
) {
  if (session.status === "cancelled") return "cancelled" as const;
  if (session.status === "completed") return "ended" as const;

  const opensAt = new Date(new Date(session.starts_at).getTime() - 15 * 60_000);
  const closesAt = new Date(new Date(session.ends_at).getTime() + 60 * 60_000);
  if (now < opensAt) return "not_open" as const;
  if (now > closesAt) return "ended" as const;
  return "open" as const;
}

export function liveSessionReplayIsAvailable(
  session: Pick<
    LiveSessionWithMentor,
    "replay" | "replay_available_from" | "replay_available_until"
  >,
  now = new Date()
) {
  if (!session.replay) return false;
  if (
    session.replay_available_from &&
    new Date(session.replay_available_from) > now
  ) {
    return false;
  }
  return (
    !session.replay_available_until ||
    new Date(session.replay_available_until) > now
  );
}
