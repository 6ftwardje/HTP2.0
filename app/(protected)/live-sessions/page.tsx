import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";
import {
  canAccessSubscriberContent,
  getBillingOverview,
} from "@/lib/billing";
import {
  listPastLiveSessions,
  listUpcomingLiveSessions,
  liveSessionJoinState,
  liveSessionReplayIsAvailable,
} from "@/lib/live-sessions";
import { ensureCurrentStudent } from "@/lib/students";
import type { LiveSessionWithMentor } from "@/lib/types";

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
    timeZoneName: "short",
  }).format(new Date(value));
}

function mentorName(session: LiveSessionWithMentor) {
  return session.mentor?.name ?? session.mentor?.email ?? "Cryptoriez mentor";
}

export default async function LiveSessionsPage() {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;

  const billingOverview = await getBillingOverview(student.id);
  if (!canAccessSubscriberContent(student, billingOverview)) {
    return (
      <SubscriptionPaywall
        overview={billingOverview}
        title="Ontgrendel de wekelijkse Weekly Outlook"
      />
    );
  }

  const [upcoming, past] = await Promise.all([
    listUpcomingLiveSessions(8),
    listPastLiveSessions(24),
  ]);
  const nextSession = upcoming[0] ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Weekly Outlook"
        title="Live sessies"
        description="Bekijk de agenda, neem deel aan de wekelijkse livesessie en herbekijk beschikbare replays."
      />

      <main className="space-y-9">
        {nextSession ? (
          <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="p-6 sm:p-8">
                <div className="cb-eyebrow">Volgende livesessie</div>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-[var(--foreground)] sm:text-3xl">
                  {nextSession.title}
                </h2>
                <p className="mt-3 font-semibold capitalize text-[var(--foreground)]">
                  {formatSessionDate(nextSession.starts_at)}
                </p>
                <p className="mt-1 cb-caption">Met {mentorName(nextSession)}</p>
                {nextSession.description ? (
                  <p className="mt-5 max-w-2xl cb-body">{nextSession.description}</p>
                ) : null}

                <div className="mt-7 flex flex-wrap gap-3">
                  {liveSessionJoinState(nextSession) === "open" ? (
                    <form action={`/api/live-sessions/${nextSession.id}/join`} method="post">
                      <button type="submit" className="cb-btn cb-btn-primary">
                        Deelnemen aan livesessie
                      </button>
                    </form>
                  ) : (
                    <span className="cb-btn cb-btn-secondary cursor-default opacity-70">
                      Deelname opent 15 minuten vooraf
                    </span>
                  )}
                  <a
                    href={`/api/live-sessions/${nextSession.id}/calendar`}
                    className="cb-btn cb-btn-secondary"
                  >
                    Voeg toe aan agenda
                  </a>
                </div>
              </div>

              <aside className="border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--card))] p-6 lg:border-l lg:border-t-0 lg:p-8">
                <div className="cb-eyebrow">In deze sessie</div>
                <p className="mt-4 cb-body">
                  De mentors overlopen de belangrijkste scenario&apos;s voor Forex, Crypto, Stocks en Commodities voor de komende week.
                </p>
                <p className="mt-5 cb-caption">
                  Kan je er niet live bij zijn? De replay blijft na publicatie minstens vier weken beschikbaar.
                </p>
              </aside>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <h2 className="cb-section-title">Nog geen nieuwe livesessie gepland</h2>
            <p className="mt-3 cb-body">
              Zodra de volgende Weekly Outlook is ingepland, verschijnt die hier en op je dashboard.
            </p>
          </section>
        )}

        {upcoming.length > 1 ? (
          <section>
            <div className="cb-eyebrow">Later gepland</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {upcoming.slice(1).map((session) => (
                <article key={session.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                  <h3 className="font-extrabold text-[var(--foreground)]">{session.title}</h3>
                  <p className="mt-2 text-sm capitalize text-[var(--muted)]">
                    {formatSessionDate(session.starts_at)}
                  </p>
                  <a href={`/api/live-sessions/${session.id}/calendar`} className="mt-4 inline-flex text-sm font-bold text-[var(--accent)] hover:underline">
                    Toevoegen aan agenda
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="cb-eyebrow">Archief</div>
              <h2 className="mt-2 cb-section-title">Eerdere livesessies</h2>
            </div>
          </div>

          {past.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((session) => {
                const replayAvailable = liveSessionReplayIsAvailable(session);
                return (
                  <article key={session.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div className="cb-eyebrow">
                      {session.status === "cancelled" ? "Geannuleerd" : "Afgelopen"}
                    </div>
                    <h3 className="mt-3 font-extrabold text-[var(--foreground)]">{session.title}</h3>
                    <p className="mt-2 text-sm capitalize text-[var(--muted)]">
                      {formatSessionDate(session.starts_at)}
                    </p>
                    {session.status === "cancelled" ? (
                      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                        {session.cancellation_reason}
                      </p>
                    ) : replayAvailable && session.replay ? (
                      <Link href={`/market-analysis/${session.replay.slug}`} className="mt-5 inline-flex cb-btn cb-btn-secondary">
                        Bekijk replay
                      </Link>
                    ) : (
                      <p className="mt-4 cb-caption">Replay nog niet gepubliceerd of niet meer beschikbaar.</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 cb-body">Er zijn nog geen eerdere livesessies.</p>
          )}
        </section>
      </main>
    </div>
  );
}
