import {
  adminAttachLiveSessionReplay,
  adminCancelLiveSession,
  adminCreateLiveSession,
  adminPublishLiveSession,
  adminSetLiveSessionStatus,
} from "@/app/actions/admin/live-sessions";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/service";
import type { LiveSession, Student, WeeklyUpdate } from "@/lib/types";

function localInputDate(value = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels",
  })
    .format(value)
    .replace(" ", "T");
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  }).format(new Date(value));
}

export default async function AdminLiveSessionsPage() {
  await requireAdmin();
  const db = createServiceClient();
  const [{ data: sessions }, { data: mentors }, { data: replays }] = await Promise.all([
    db.from("live_sessions").select("*").order("starts_at", { ascending: false }).limit(50),
    db.from("students").select("id, name, email").eq("access_level", 3).order("name"),
    db
      .from("weekly_updates")
      .select("id, title, slug")
      .eq("type", "weekly_outlook")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(30),
  ]);

  const liveSessions = (sessions ?? []) as LiveSession[];
  const mentorOptions = (mentors ?? []) as Pick<Student, "id" | "name" | "email">[];
  const replayOptions = (replays ?? []) as Pick<WeeklyUpdate, "id" | "title" | "slug">[];

  return (
    <div>
      <PageHeader
        eyebrow="Marktinzicht"
        title="Live marktsessies"
        description="Plan sessies, beheer de beveiligde deelname-link, zet een sessie live en publiceer daarna de opname."
      />

      <div className="grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="cb-panel h-fit p-6 xl:sticky xl:top-6">
          <h2 className="cb-h2">Nieuwe live marktsessie</h2>
          <form action={adminCreateLiveSession} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">
              Titel
              <input name="title" required className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5" />
            </label>
            <label className="block text-sm font-semibold">
              Omschrijving
              <textarea name="description" rows={4} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5" />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold">Gerelateerde markten</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[["crypto", "Crypto"], ["forex", "Forex"], ["stocks", "Aandelen"], ["commodities", "Grondstoffen"], ["macro", "Macro"]].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"><input type="checkbox" name="markets" value={value} />{label}</label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-semibold">
              Start in Brussel/Amsterdam
              <input name="starts_at" type="datetime-local" required defaultValue={localInputDate(new Date(Date.now() + 7 * 24 * 60 * 60_000))} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5" />
            </label>
            <label className="block text-sm font-semibold">
              Duur in minuten
              <input name="duration_minutes" type="number" min="15" max="480" defaultValue="60" required className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5" />
            </label>
            <label className="block text-sm font-semibold">
              Mentor
              <select name="mentor_student_id" className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
                <option value="">Nog niet toegewezen</option>
                {mentorOptions.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>{mentor.name ?? mentor.email}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              ClickMeeting event-ID
              <input name="provider_event_id" className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5" />
            </label>
            <label className="block text-sm font-semibold">
              ClickMeeting deelname-URL
              <input name="external_join_url" type="url" placeholder="https://..." className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5" />
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input name="is_published" type="checkbox" className="mt-1" />
              <span><strong>Publiceren en studenten melden</strong><br /><span className="text-[var(--muted)]">Bewaar zonder vinkje eerst als draft.</span></span>
            </label>
            <button type="submit" className="cb-btn cb-btn-primary w-full justify-center">Sessie opslaan</button>
          </form>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="cb-section-title">Agenda en archief</h2>
            <span className="cb-caption">{liveSessions.length} sessies</span>
          </div>
          <div className="mt-5 space-y-4">
            {liveSessions.map((session) => (
              <article key={session.id} className="cb-panel p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="cb-eyebrow">{session.status}</div>
                    <h3 className="mt-2 text-lg font-extrabold">{session.title}</h3>
                    <p className="mt-2 cb-caption">{displayDate(session.starts_at)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${session.is_published ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"}`}>
                    {session.is_published ? "Gepubliceerd" : "Draft"}
                  </span>
                </div>

                {!session.is_published && session.status === "draft" ? (
                  <form action={adminPublishLiveSession.bind(null, session.id)} className="mt-5 grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_auto]">
                    <input name="provider_event_id" placeholder="ClickMeeting event-ID" className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                    <input name="external_join_url" type="url" required placeholder="https://... deelname-URL" className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                    <button type="submit" className="cb-btn cb-btn-primary">Publiceren + melden</button>
                  </form>
                ) : null}

                {session.is_published && (session.status === "scheduled" || session.status === "live") ? (
                  <form action={adminSetLiveSessionStatus.bind(null, session.id, session.status === "live" ? "scheduled" : "live")} className="mt-4">
                    <button type="submit" className="cb-btn cb-btn-secondary">{session.status === "live" ? "Terug naar Aankomend" : "Zet op Live"}</button>
                  </form>
                ) : null}

                {session.status !== "cancelled" && session.status !== "completed" ? (
                  <form action={adminCancelLiveSession.bind(null, session.id)} className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row">
                    <input name="cancellation_reason" required placeholder="Reden voor annulering" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                    <button type="submit" className="cb-btn cb-btn-secondary text-red-700">Annuleren + melden</button>
                  </form>
                ) : null}

                {session.status !== "cancelled" && new Date(session.ends_at) <= new Date() && replayOptions.length > 0 ? (
                  <form action={adminAttachLiveSessionReplay.bind(null, session.id)} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <select name="replay_weekly_update_id" required defaultValue={session.replay_weekly_update_id ?? ""} className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                      <option value="">Kies opname</option>
                      {replayOptions.map((replay) => <option key={replay.id} value={replay.id}>{replay.title}</option>)}
                    </select>
                    <button type="submit" className="cb-btn cb-btn-secondary">Als opname publiceren</button>
                  </form>
                ) : null}
              </article>
            ))}
            {liveSessions.length === 0 ? <div className="cb-panel border-dashed p-8 text-center cb-body">Nog geen livesessies gepland.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
