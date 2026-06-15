import { PageHeader } from "@/components/layout/PageHeader";
import { MentorChatPanel } from "@/components/mentor/MentorChatPanel";
import { getOrCreateStudentMentorConversation } from "@/lib/mentor-chat";

export default async function MentorPage() {
  const { conversation, missingMigration, error } =
    await getOrCreateStudentMentorConversation();

  return (
    <div>
      <PageHeader
        eyebrow="Mentor"
        title="Chat met Rousso"
        description="Gebruik deze chat voor vragen over lessen, setups, marktcontext of je volgende stap binnen het traject."
      />

      {missingMigration ? (
        <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">
            Mentorchat is bijna klaar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            De applicatiecode staat klaar. Pas de nieuwe Supabase migration toe om gesprekken,
            berichten en notificaties te activeren.
          </p>
        </section>
      ) : error ? (
        <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">
            Chat laden mislukt
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{error}</p>
        </section>
      ) : conversation ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <MentorChatPanel
            thread={conversation.thread}
            messages={conversation.messages}
          />

          <aside className="space-y-4">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Sneller antwoord
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--foreground)]">
                <li>Vermeld de module of les waar je mee bezig bent.</li>
                <li>Beschrijf wat je al geprobeerd hebt.</li>
                <li>Maak je vraag concreet: entry, risk, mindset of planning.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Voorbeelden
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <p>“Ik twijfel of mijn zone valide is in module technische analyse.”</p>
                <p>“Ik begrijp mijn fout na dit examen nog niet.”</p>
                <p>“Wanneer is 1-op-1 begeleiding zinvol voor mijn situatie?”</p>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
