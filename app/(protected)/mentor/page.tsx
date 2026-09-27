import { PageHeader } from "@/components/layout/PageHeader";
import { MentorChatPanel } from "@/components/mentor/MentorChatPanel";
import { getOrCreateStudentMentorConversation } from "@/lib/mentor-chat";

export default async function MentorPage() {
  const { conversation, missingMigration, error } =
    await getOrCreateStudentMentorConversation();

  return (
    <div>
      <PageHeader
        title="Stel je vraag aan een mentor"
        description="Vraag hulp bij een les, je analyse of je volgende stap. Je krijgt antwoord in dit gesprek."
      />

      {missingMigration || error ? (
        <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">
            Chat tijdelijk niet beschikbaar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            We kunnen je gesprek nu niet openen. Probeer het later opnieuw of
            mail ons als je hulp nodig hebt.
          </p>
          <a href="mailto:info@hettradeplatform.be" className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
            Mail ons →
          </a>
        </section>
      ) : conversation ? (
        <div className="max-w-4xl">
          <MentorChatPanel
            thread={conversation.thread}
            messages={conversation.messages}
          />
        </div>
      ) : null}
    </div>
  );
}
