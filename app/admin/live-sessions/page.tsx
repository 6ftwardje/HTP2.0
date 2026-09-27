import Link from "next/link";
import {
  adminAttachLiveSessionReplay,
  adminCancelLiveSession,
  adminCreateLiveSession,
  adminPublishLiveSession,
  adminRepairLiveSessionNotification,
  adminSetLiveSessionStatus,
} from "@/app/actions/admin/live-sessions";
import { PageHeader } from "@/components/layout/PageHeader";
import { LiveSessionActionForm } from "@/components/admin/LiveSessionActionForm";
import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/service";
import { repairableLiveSessionNotificationType } from "@/lib/admin/live-session-notification-repair";
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

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
}

function statusLabel(status: LiveSession["status"]) {
  if (status === "draft") return "Concept";
  if (status === "scheduled") return "Gepland";
  if (status === "live") return "Live";
  if (status === "completed") return "Afgerond";
  return "Geannuleerd";
}

const PAGE_SIZE = 25;

export default async function AdminLiveSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ agenda?: string; archief?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const agendaPage = parsePage(params.agenda);
  const archivePage = parsePage(params.archief);
  const nowIso = new Date().toISOString();
  const db = createServiceClient();
  const [agendaResult, archiveResult, { data: mentors }, { data: replays }] = await Promise.all([
    db.from("live_sessions")
      .select("*", { count: "exact" })
      .gte("ends_at", nowIso)
      .in("status", ["draft", "scheduled", "live"])
      .order("starts_at", { ascending: true })
      .range((agendaPage - 1) * PAGE_SIZE, agendaPage * PAGE_SIZE - 1),
    db.from("live_sessions")
      .select("*", { count: "exact" })
      .or(`ends_at.lt.${nowIso},status.in.(completed,cancelled)`)
      .order("starts_at", { ascending: false })
      .range((archivePage - 1) * PAGE_SIZE, archivePage * PAGE_SIZE - 1),
    db.from("students").select("id, name, email").eq("access_level", 3).order("name"),
    db
      .from("weekly_updates")
      .select("id, title, slug")
      .eq("type", "weekly_outlook")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(30),
  ]);

  const upcomingSessions = (agendaResult.data ?? []) as LiveSession[];
  const archivedSessions = (archiveResult.data ?? []) as LiveSession[];
  const mentorOptions = (mentors ?? []) as Pick<Student, "id" | "name" | "email">[];
  const replayOptions = (replays ?? []) as Pick<WeeklyUpdate, "id" | "title" | "slug">[];

  function renderSession(session: LiveSession) {
    const hasEnded = new Date(session.ends_at) <= new Date(nowIso);
    return (
      <article key={session.id} className="cb-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--muted)]">{statusLabel(session.status)}</div>
            <h3 className="mt-2 break-words text-lg font-extrabold">{session.title}</h3>
            <p className="mt-2 cb-caption">{displayDate(session.starts_at)}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${session.is_published ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"}`}>
            {session.is_published ? "Gepubliceerd" : "Concept"}
          </span>
        </div>

        {!session.is_published && session.status === "draft" && !hasEnded ? (
          <LiveSessionActionForm action={adminPublishLiveSession.bind(null, session.id)} successMessage="Sessie gepubliceerd." className="mt-5 grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)_auto]">
            <input name="provider_event_id" placeholder="ClickMeeting event-ID" className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <input name="external_join_url" type="url" required placeholder="https://... deelname-URL" className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <button type="submit" className="cb-btn cb-btn-primary">Publiceren + melden</button>
          </LiveSessionActionForm>
        ) : null}

        {session.is_published && !hasEnded && (session.status === "scheduled" || session.status === "live") ? (
          <LiveSessionActionForm action={adminSetLiveSessionStatus.bind(null, session.id, session.status === "live" ? "scheduled" : "live")} successMessage="Sessiestatus bijgewerkt." className="mt-4">
            <button type="submit" className="cb-btn cb-btn-secondary">{session.status === "live" ? "Terug naar gepland" : "Zet op live"}</button>
          </LiveSessionActionForm>
        ) : null}

        {!hasEnded && session.status !== "cancelled" && session.status !== "completed" ? (
          <LiveSessionActionForm action={adminCancelLiveSession.bind(null, session.id)} successMessage="Sessie geannuleerd." className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:flex-wrap">
            <input name="cancellation_reason" required placeholder="Reden voor annulering" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <button type="submit" className="cb-btn cb-btn-secondary text-red-700">Annuleren + melden</button>
          </LiveSessionActionForm>
        ) : null}

        {session.status !== "cancelled" && hasEnded && replayOptions.length > 0 ? (
          <LiveSessionActionForm action={adminAttachLiveSessionReplay.bind(null, session.id)} successMessage="Opname gekoppeld." className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <select name="replay_weekly_update_id" required defaultValue={session.replay_weekly_update_id ?? ""} className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">Kies opname</option>
              {replayOptions.map((replay) => <option key={replay.id} value={replay.id}>{replay.title}</option>)}
            </select>
            <button type="submit" className="cb-btn cb-btn-secondary">Als opname publiceren</button>
          </LiveSessionActionForm>
        ) : null}

        {!session.is_published && session.status === "draft" && hasEnded && (
          <p className="cb-caption mt-4">Dit concept is verstreken en kan niet meer worden gepubliceerd. Plan een nieuwe sessie.</p>
        )}

        {repairableLiveSessionNotificationType(session, new Date(nowIso)) && (
          <LiveSessionActionForm
            action={adminRepairLiveSessionNotification.bind(null, session.id)}
            successMessage="Melding gecontroleerd; ontbrekende ontvangers zijn aangevuld."
            className="mt-5 border-t border-[var(--border)] pt-4"
          >
            <button type="submit" className="cb-btn cb-btn-secondary text-sm">Melding controleren</button>
          </LiveSessionActionForm>
        )}
      </article>
    );
  }

  function pageHref(agenda: number, archief: number) {
    return `/admin/live-sessions?agenda=${agenda}&archief=${archief}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Marktinzicht"
        title="Live marktsessies"
        description="Plan sessies, beheer de beveiligde deelname-link, zet een sessie live en publiceer daarna de opname."
        actions={<a href="#nieuwe-sessie" className="cb-btn cb-btn-secondary xl:hidden">Nieuwe sessie</a>}
      />

      <div className="grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section id="nieuwe-sessie" className="order-2 cb-panel h-fit scroll-mt-6 p-6 xl:order-1 xl:sticky xl:top-6">
          <h2 className="cb-h2">Nieuwe live marktsessie</h2>
          <LiveSessionActionForm action={adminCreateLiveSession} successMessage="Sessie opgeslagen." resetOnSuccess className="mt-6 space-y-4">
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
              <span><strong>Publiceren en studenten melden</strong><br /><span className="text-[var(--muted)]">Zonder vinkje bewaar je de sessie als concept.</span></span>
            </label>
            <button type="submit" className="cb-btn cb-btn-primary w-full justify-center">Sessie opslaan</button>
          </LiveSessionActionForm>
        </section>

        <div className="order-1 space-y-10 xl:order-2">
          {(agendaResult.error || archiveResult.error) && (
            <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-200">
              De sessies konden niet volledig worden geladen. Herlaad de pagina en probeer opnieuw.
            </p>
          )}

          <section aria-labelledby="upcoming-sessions-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="upcoming-sessions-heading" className="cb-section-title">Aankomende sessies</h2>
              <span className="cb-caption">{agendaResult.count ?? upcomingSessions.length} sessies</span>
            </div>
            <div className="mt-5 space-y-4">
              {upcomingSessions.map(renderSession)}
              {!agendaResult.error && upcomingSessions.length === 0 && (
                <div className="cb-panel border-dashed p-8 text-center cb-body">
                  {agendaPage > 1 ? "Geen sessies op deze pagina. Ga terug naar de vorige pagina." : "Er staan geen aankomende sessies. Plan een nieuwe sessie."}
                </div>
              )}
            </div>
            {(agendaResult.count ?? 0) > PAGE_SIZE && (
              <nav aria-label="Pagina's aankomende sessies" className="mt-4 flex items-center justify-between gap-3 text-sm">
                {agendaPage > 1 ? <Link href={pageHref(agendaPage - 1, archivePage)} className="cb-btn cb-btn-secondary">Vorige</Link> : <span />}
                <span className="cb-caption">Pagina {agendaPage}</span>
                {agendaPage * PAGE_SIZE < (agendaResult.count ?? 0) ? <Link href={pageHref(agendaPage + 1, archivePage)} className="cb-btn cb-btn-secondary">Volgende</Link> : <span />}
              </nav>
            )}
          </section>

          <section aria-labelledby="archived-sessions-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="archived-sessions-heading" className="cb-section-title">Archief</h2>
              <span className="cb-caption">{archiveResult.count ?? archivedSessions.length} sessies</span>
            </div>
            <div className="mt-5 space-y-4">
              {archivedSessions.map(renderSession)}
              {!archiveResult.error && archivedSessions.length === 0 && (
                <div className="cb-panel border-dashed p-8 text-center cb-body">
                  {archivePage > 1 ? "Geen sessies op deze pagina. Ga terug naar de vorige pagina." : "Nog geen eerdere of afgesloten sessies."}
                </div>
              )}
            </div>
            {(archiveResult.count ?? 0) > PAGE_SIZE && (
              <nav aria-label="Pagina's archief" className="mt-4 flex items-center justify-between gap-3 text-sm">
                {archivePage > 1 ? <Link href={pageHref(agendaPage, archivePage - 1)} className="cb-btn cb-btn-secondary">Vorige</Link> : <span />}
                <span className="cb-caption">Pagina {archivePage}</span>
                {archivePage * PAGE_SIZE < (archiveResult.count ?? 0) ? <Link href={pageHref(agendaPage, archivePage + 1)} className="cb-btn cb-btn-secondary">Volgende</Link> : <span />}
              </nav>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
