"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminMarkMentorThreadRead,
  adminReplyToMentorThread,
  adminUpdateMentorThread,
} from "@/app/actions/admin/mentor-chat";
import type {
  AdminMentorThreadDetail,
  AdminMentorThreadRow,
} from "@/lib/mentor-chat";
import { useMentorInboxRealtime } from "@/lib/realtime-hooks";
import type { ConversationMessage } from "@/lib/types";

function formatShortDate(value: string | null) {
  if (!value) return "Nog geen bericht";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "pending_mentor") return "Te beantwoorden";
  if (status === "pending_student") return "Wacht op student";
  if (status === "snoozed") return "Snoozed";
  if (status === "closed") return "Gesloten";
  return "Open";
}

function priorityClass(priority: string) {
  if (priority === "urgent") return "border-red-500/30 text-red-500";
  if (priority === "high") return "border-amber-500/30 text-amber-500";
  return "border-[var(--border)] text-[var(--muted)]";
}

function senderLabel(message: ConversationMessage) {
  if (message.is_internal) return "Interne notitie";
  if (message.sender_role === "student") return "Student";
  if (message.sender_role === "ai") return "AI";
  return "Rousso";
}

export function MentorInbox({
  rows,
  detail,
  status,
  q,
}: {
  rows: AdminMentorThreadRow[];
  detail: AdminMentorThreadDetail | null;
  status: string;
  q: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [replyPending, startReplyTransition] = useTransition();
  const [metaPending, startMetaTransition] = useTransition();

  useMentorInboxRealtime(detail?.thread.id ?? null);

  useEffect(() => {
    if (!detail || detail.thread.unread_for_mentor_count <= 0) return;
    adminMarkMentorThreadRead(detail.thread.id);
  }, [detail]);

  function submitReply(formData: FormData) {
    if (!detail) return;
    setReplyError(null);
    startReplyTransition(async () => {
      const result = await adminReplyToMentorThread(detail.thread.id, formData);
      if (!result.success) {
        setReplyError(result.error ?? "Antwoord verzenden mislukt.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  function submitMeta(formData: FormData) {
    if (!detail) return;
    setMetaError(null);
    startMetaTransition(async () => {
      const result = await adminUpdateMentorThread(detail.thread.id, formData);
      if (!result.success) {
        setMetaError(result.error ?? "Thread bijwerken mislukt.");
        return;
      }
      router.refresh();
    });
  }

  const selectedId = detail?.thread.id ?? null;

  return (
    <div className="grid min-h-[680px] gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Gesprekken
            </span>
            <span className="rounded-full border border-emerald-500/25 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-emerald-500">
              Live
            </span>
          </div>
          <form className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="Zoek student of bericht"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--border))]"
              />
              <select
                name="status"
                defaultValue={status}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--border))]"
              >
                <option value="active">Actief</option>
                <option value="unread">Ongelezen</option>
                <option value="pending_mentor">Te beantwoorden</option>
                <option value="pending_student">Wacht op student</option>
                <option value="open">Open</option>
                <option value="snoozed">Snoozed</option>
                <option value="closed">Gesloten</option>
              </select>
            </div>
            <button type="submit" className="cb-btn cb-btn-secondary w-full justify-center px-4 py-2 text-sm">
              Filter
            </button>
          </form>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="p-5 text-sm leading-7 text-[var(--muted)]">
              Geen gesprekken gevonden.
            </div>
          ) : (
            rows.map((row) => {
              const selected = row.id === selectedId;
              const studentName = row.student?.name ?? row.student?.email ?? "Student";
              return (
                <Link
                  key={row.id}
                  href={`/admin/mentor-inbox?thread=${row.id}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`}
                  className={`block border-b border-[var(--border)] p-4 transition hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] ${
                    selected ? "bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {row.unread_for_mentor_count > 0 && (
                          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                        )}
                        <p className="truncate font-bold text-[var(--foreground)]">
                          {studentName}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
                        {statusLabel(row.status)} · {formatShortDate(row.last_message_at)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[0.65rem] font-bold uppercase ${priorityClass(row.priority)}`}>
                      {row.priority}
                    </span>
                  </div>
                  {row.lastMessage && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                      {row.lastMessage.body}
                    </p>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </section>

      {detail ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <div className="border-b border-[var(--border)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                {detail.thread.student?.email ?? "Onbekende student"}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">
                {detail.thread.student?.name ?? "Studentgesprek"}
              </h2>
            </div>

            <div className="max-h-[52vh] min-h-[380px] space-y-4 overflow-y-auto p-5">
              {detail.messages.length === 0 ? (
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Nog geen berichten in deze thread.
                </p>
              ) : (
                detail.messages.map((message) => {
                  const mentor = message.sender_role !== "student";
                  return (
                    <article
                      key={message.id}
                      className={`rounded-xl border px-4 py-3 ${
                        message.is_internal
                          ? "border-amber-500/30 bg-amber-500/10"
                          : mentor
                            ? "border-[var(--border)] bg-[var(--background)]"
                            : "border-[color-mix(in_oklab,var(--accent)_35%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_9%,var(--background)_91%)]"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                          {senderLabel(message)}
                        </span>
                        <time className="text-xs text-[var(--muted)]">
                          {formatShortDate(message.created_at)}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
                        {message.body}
                      </p>
                    </article>
                  );
                })
              )}
            </div>

            <form ref={formRef} action={submitReply} className="border-t border-[var(--border)] p-4">
              <textarea
                name="body"
                rows={4}
                maxLength={5000}
                placeholder="Antwoord als Rousso..."
                className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-7 outline-none focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--border))]"
                required
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
                  <input type="checkbox" name="is_internal" className="h-4 w-4" />
                  Interne notitie
                </label>
                <button
                  type="submit"
                  disabled={replyPending}
                  className="cb-btn cb-btn-primary justify-center px-5 py-3"
                >
                  {replyPending ? "Verzenden..." : "Verstuur"}
                </button>
              </div>
              {replyError && (
                <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
                  {replyError}
                </p>
              )}
            </form>
          </div>

          <aside className="space-y-4">
            <form action={submitMeta} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Thread triage
              </h2>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                    Status
                  </span>
                  <select
                    name="status"
                    defaultValue={detail.thread.status}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="pending_mentor">Te beantwoorden</option>
                    <option value="pending_student">Wacht op student</option>
                    <option value="snoozed">Snoozed</option>
                    <option value="closed">Gesloten</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                    Prioriteit
                  </span>
                  <select
                    name="priority"
                    defaultValue={detail.thread.priority}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
                    Categorie
                  </span>
                  <input
                    name="category"
                    defaultValue={detail.thread.category ?? ""}
                    placeholder="strategy, mindset, sales..."
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={metaPending}
                  className="cb-btn cb-btn-secondary w-full justify-center px-4 py-2 text-sm"
                >
                  {metaPending ? "Opslaan..." : "Opslaan"}
                </button>
                {metaError && (
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {metaError}
                  </p>
                )}
              </div>
            </form>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Student context
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[var(--muted)]">Mentorstatus</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {detail.thread.student?.mentor_status ?? "Onbekend"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Tags</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {detail.thread.student?.tags.length
                      ? detail.thread.student.tags.join(", ")
                      : "Geen tags"}
                  </dd>
                </div>
              </dl>
              {detail.thread.student && (
                <Link
                  href={`/admin/students/${detail.thread.student.id}`}
                  className="mt-5 inline-flex w-full cb-btn cb-btn-secondary justify-center px-4 py-2 text-sm"
                >
                  Open studentprofiel
                </Link>
              )}
            </section>
          </aside>
        </section>
      ) : (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
          <h2 className="text-xl font-extrabold text-[var(--foreground)]">
            Selecteer een gesprek
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Nieuwe mentorvragen verschijnen automatisch links in de inbox.
          </p>
        </section>
      )}
    </div>
  );
}
