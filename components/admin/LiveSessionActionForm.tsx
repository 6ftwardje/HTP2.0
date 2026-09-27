"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function LiveSessionActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  successMessage: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    const form = event.currentTarget;
    try {
      await action(new FormData(form));
      setFeedback({ success: true, text: successMessage });
      if (resetOnSuccess) form.reset();
      router.refresh();
    } catch {
      setFeedback({
        success: false,
        text: "Het resultaat kon niet worden bevestigd. Je invoer is bewaard; herlaad de agenda voordat je opnieuw probeert.",
      });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={className} aria-busy={pending}>
      {children}
      {pending && <p role="status" className="text-sm text-[var(--muted)] sm:col-span-full">Bezig met opslaan…</p>}
      {feedback && (
        <p
          role={feedback.success ? "status" : "alert"}
          className={`w-full basis-full rounded-lg border px-3 py-2 text-sm font-semibold sm:col-span-full ${
            feedback.success
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </form>
  );
}
