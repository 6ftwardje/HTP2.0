"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markMentorThreadRead,
  sendMentorMessage,
} from "@/app/actions/mentor-chat";
import { useConversationRealtime } from "@/lib/realtime-hooks";
import type { ConversationMessage, ConversationThread } from "@/lib/types";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function senderLabel(message: ConversationMessage) {
  if (message.sender_role === "student") return "Jij";
  if (message.sender_role === "ai") return "AI assistent";
  return "Rousso";
}

function threadStatusLabel(thread: ConversationThread) {
  if (thread.status === "pending_mentor") return "Wacht op mentor";
  if (thread.status === "pending_student") return "Rousso heeft geantwoord";
  if (thread.status === "closed") return "Afgesloten";
  if (thread.status === "snoozed") return "Later opvolgen";
  return "Open";
}

export function MentorChatPanel({
  thread,
  messages,
}: {
  thread: ConversationThread;
  messages: ConversationMessage[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientMessageId, setClientMessageId] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  useConversationRealtime(thread.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (thread.unread_for_student_count <= 0) return;
    markMentorThreadRead(thread.id);
  }, [thread.id, thread.unread_for_student_count]);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await sendMentorMessage(formData);
      if (!result.success) {
        setError(result.error ?? "Bericht verzenden mislukt.");
        return;
      }
      formRef.current?.reset();
      setClientMessageId(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--background)_12%)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">Directe lijn met Rousso</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Stel je vraag concreet. Voeg context toe over de les, setup of twijfel waar je op vastloopt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit items-center rounded-full border border-emerald-500/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.13em] text-emerald-500">
            Live
          </span>
          <span className="inline-flex w-fit items-center rounded-full border border-[var(--border)] px-3 py-1 text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
            {threadStatusLabel(thread)}
          </span>
        </div>
      </div>

      <div className="max-h-[58vh] min-h-[360px] space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="max-w-md text-center">
              <p className="text-xl font-extrabold text-[var(--foreground)]">
                Waar kan Rousso je mee helpen?
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Goede vragen bevatten meestal drie dingen: waar je naar kijkt, wat je al geprobeerd hebt
                en waar de twijfel precies zit.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const own = message.sender_role === "student";
            return (
              <article
                key={message.id}
                className={`flex ${own ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(680px,88%)] rounded-xl border px-4 py-3 ${
                    own
                      ? "border-[color-mix(in_oklab,var(--accent)_38%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_12%,var(--card)_88%)]"
                      : "border-[var(--border)] bg-[var(--background)]"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-4">
                    <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                      {senderLabel(message)}
                    </span>
                    <time className="text-xs text-[var(--muted)]">
                      {formatMessageTime(message.created_at)}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
                    {message.body}
                  </p>
                </div>
              </article>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        ref={formRef}
        action={onSubmit}
        className="border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,var(--card)_12%)] p-4"
      >
        <input type="hidden" name="client_message_id" value={clientMessageId} />
        <label htmlFor="mentor-message" className="sr-only">
          Je bericht aan Rousso
        </label>
        <textarea
          id="mentor-message"
          name="body"
          rows={4}
          maxLength={5000}
          placeholder="Typ je vraag aan Rousso..."
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--border))] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_18%,transparent)]"
          required
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Tip: vermeld de module, je setup of de concrete keuze waar je twijfelt.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="cb-btn cb-btn-primary justify-center px-5 py-3"
          >
            {pending ? "Verzenden..." : "Stuur naar Rousso"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
