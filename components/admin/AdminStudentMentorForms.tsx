"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  adminCreateStudentMentorNote,
  adminUpdateStudentMentorMeta,
} from "@/app/actions/admin/students";
import type { Student } from "@/lib/types";

function fieldClass() {
  return "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border))]";
}

type Feedback = { success: boolean; text: string } | null;

function ActionFeedback({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      role={feedback.success ? "status" : "alert"}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        feedback.success
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200"
      }`}
    >
      {feedback.text}
    </p>
  );
}

export function MentorMetaForm({
  studentId,
  mentorStatus,
  tags,
}: {
  studentId: string;
  mentorStatus: Student["mentor_status"];
  tags: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFeedback(null);
    try {
      const result = await adminUpdateStudentMentorMeta(studentId, new FormData(event.currentTarget));
      setFeedback(
        result.success
          ? { success: true, text: "Begeleiding opgeslagen." }
          : { success: false, text: result.error ?? "Begeleiding kon niet worden opgeslagen. Probeer opnieuw." }
      );
      if (result.success) router.refresh();
    } catch {
      setFeedback({ success: false, text: "Verbinding onderbroken. Je wijzigingen staan nog in het formulier; probeer opnieuw." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <fieldset disabled={pending} className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Status</span>
          <select name="mentor_status" defaultValue={mentorStatus ?? "active"} className={fieldClass()}>
            <option value="active">Actief</option>
            <option value="watch">Opvolgen</option>
            <option value="needs_attention">Aandacht nodig</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Onderwerpen (tags)</span>
          <input name="tags" defaultValue={tags.join(", ")} placeholder="Bijv. risicobeheer, mindset" className={fieldClass()} />
        </label>
        <button type="submit" disabled={pending} className="cb-btn cb-btn-primary">
          {pending ? "Opslaan…" : "Begeleiding opslaan"}
        </button>
      </fieldset>
      <ActionFeedback feedback={feedback} />
    </form>
  );
}

export function MentorNoteForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFeedback(null);
    try {
      const result = await adminCreateStudentMentorNote(studentId, new FormData(event.currentTarget));
      setFeedback(
        result.success
          ? { success: true, text: "Notitie toegevoegd." }
          : { success: false, text: result.error ?? "Notitie kon niet worden toegevoegd. Probeer opnieuw." }
      );
      if (result.success) {
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setFeedback({ success: false, text: "Verbinding onderbroken. Je notitie staat nog in het formulier; probeer opnieuw." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mt-5 space-y-3">
      <fieldset disabled={pending} className="space-y-3">
        <textarea
          name="body"
          rows={4}
          required
          maxLength={5000}
          placeholder="Wat is besproken? Wat is de volgende stap?"
          className={fieldClass()}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <input name="is_pinned" type="checkbox" className="h-4 w-4" />
            Notitie vastzetten
          </label>
          <button type="submit" disabled={pending} className="cb-btn cb-btn-primary">
            {pending ? "Toevoegen…" : "Notitie toevoegen"}
          </button>
        </div>
      </fieldset>
      <ActionFeedback feedback={feedback} />
    </form>
  );
}
