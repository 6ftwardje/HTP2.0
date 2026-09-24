import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";
import type {
  Market,
  MarketAnalysisType,
  Student,
  WeeklyUpdate,
  WeeklyUpdateAccessTier,
  WeeklyUpdateContentFormat,
  VideoTranscriptSummary,
} from "@/lib/types";

export type AdminWeeklyUpdateRow = WeeklyUpdate & {
  mentor: Pick<Student, "id" | "name" | "email"> | null;
  transcripts: VideoTranscriptSummary[];
};

export type WeeklyUpdateInput = {
  content_format: WeeklyUpdateContentFormat;
  body: string | null;
  title: string;
  slug: string;
  summary: string | null;
  key_takeaways: string[];
  type: Exclude<MarketAnalysisType, "live_session">;
  market: Market | null;
  week_start_date: string;
  mentor_student_id: string | null;
  access_tier: WeeklyUpdateAccessTier;
  thumbnail_url: string | null;
  markets: Array<Market | "macro">;
  actuality_status: "current" | "still_relevant" | "archive";
  event_context: string | null;
  period_label: string | null;
  chapters: Array<{ title: string; seconds: number }>;
  related_content: Array<{ label: string; href: string }>;
  needs_review: boolean;
  is_published: boolean;
  published_at: string | null;
};

type WeeklyUpdateVideoUpdate = Partial<
  Pick<
    WeeklyUpdate,
    | "video_provider"
    | "video_url"
    | "video_duration_seconds"
    | "thumbnail_url"
    | "mux_asset_id"
    | "mux_playback_id"
    | "mux_playback_policy"
    | "mux_status"
    | "mux_upload_id"
    | "mux_error_message"
    | "is_published"
    | "published_at"
  >
>;

export async function listWeeklyUpdatesAdmin(): Promise<AdminWeeklyUpdateRow[]> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") return [];

  const db = await createClient();
  const { data, error } = await db
    .from("weekly_updates")
    .select(
      `
        *,
        mentor:students!weekly_updates_mentor_student_id_fkey (
          id,
          name,
          email
        ),
        transcripts:ai_video_transcripts (
          id,
          weekly_update_id,
          source_version,
          source_language,
          provider,
          provider_track_id,
          status,
          attempt_count,
          failure_code,
          failure_retryable,
          started_at,
          ready_at,
          failed_at,
          created_at,
          updated_at,
          transcript,
          workflows:ai_video_workflows (
            id,
            transcript_id,
            step,
            status,
            attempt_count,
            max_attempts,
            next_attempt_at,
            last_error_code,
            last_error_retryable,
            updated_at
          ),
          enrichments:ai_video_enrichments (
            id,
            transcript_id,
            prompt_version,
            model,
            status,
            summary,
            key_takeaways,
            chapters,
            reviewed_content,
            reviewed_by,
            reviewed_at,
            published_at,
            failure_code,
            created_at,
            updated_at
          )
        )
      `
    )
    .order("week_start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listWeeklyUpdatesAdmin", error.message);
    return [];
  }

  return (data ?? []) as AdminWeeklyUpdateRow[];
}

export async function listWeeklyUpdateMentorsAdmin(): Promise<
  Pick<Student, "id" | "name" | "email">[]
> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") return [];

  const db = await createClient();
  const { data, error } = await db
    .from("students")
    .select("id, name, email")
    .gte("access_level", 3)
    .order("name", { ascending: true });

  if (error) {
    console.error("listWeeklyUpdateMentorsAdmin", error.message);
    return [];
  }

  return (data ?? []) as Pick<Student, "id" | "name" | "email">[];
}

export async function getWeeklyUpdateAdmin(
  weeklyUpdateId: number
): Promise<WeeklyUpdate | null> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") return null;

  const db = await createClient();
  const { data, error } = await db
    .from("weekly_updates")
    .select("*")
    .eq("id", weeklyUpdateId)
    .maybeSingle();

  if (error || !data) return null;
  return data as WeeklyUpdate;
}

export async function createWeeklyUpdateAdmin(
  input: WeeklyUpdateInput & Partial<WeeklyUpdateVideoUpdate> & {
    created_by_student_id: string | null;
  }
): Promise<{ weeklyUpdate: WeeklyUpdate | null; error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { weeklyUpdate: null, error: null };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("weekly_updates")
    .insert(input)
    .select("*")
    .single();

  if (error) return { weeklyUpdate: null, error: error.message };
  return { weeklyUpdate: data as WeeklyUpdate, error: null };
}

export async function updateWeeklyUpdateAdmin(
  weeklyUpdateId: number,
  input: WeeklyUpdateInput,
  publishTransition = false
): Promise<{ error: string | null; transitioned: boolean }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") return { error: null, transitioned: publishTransition };

  const db = await createClient();
  let query = db
    .from("weekly_updates")
    .update(input)
    .eq("id", weeklyUpdateId);
  if (publishTransition) query = query.eq("is_published", false);
  const { data, error } = await query.select("id")
    .maybeSingle();

  if (error) return { error: error.message, transitioned: false };
  if (!data && publishTransition) return { error: null, transitioned: false };
  if (!data) return { error: "Weekly update not found.", transitioned: false };
  return { error: null, transitioned: publishTransition };
}

export async function updateWeeklyUpdateVideoAdmin(
  weeklyUpdateId: number,
  update: WeeklyUpdateVideoUpdate
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") return { error: null };

  const db = await createClient();
  const { data, error } = await db
    .from("weekly_updates")
    .update(update)
    .eq("id", weeklyUpdateId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Weekly update not found." };
  return { error: null };
}

export async function deleteWeeklyUpdateAdmin(
  weeklyUpdateId: number
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") return { error: null };

  const db = await createClient();
  const { error } = await db
    .from("weekly_updates")
    .delete()
    .eq("id", weeklyUpdateId);

  return { error: error?.message ?? null };
}
