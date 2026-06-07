"use client";

import { useState, useTransition } from "react";
import { toggleLessonAction } from "@/app/actions/lesson-actions";

export function LessonActionList({
  lessonId,
  actions,
  initialCompleted,
}: {
  lessonId: number;
  actions: string[];
  initialCompleted: Record<number, boolean>;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const completedCount = actions.filter((_, index) => completed[index]).length;

  function toggle(index: number) {
    const nextValue = !completed[index];
    const previous = completed;
    setCompleted((current) => ({ ...current, [index]: nextValue }));
    setError(null);

    startTransition(async () => {
      const result = await toggleLessonAction(lessonId, index, nextValue);
      if (!result.success) {
        setCompleted(previous);
        setError(result.error ?? "De opdracht kon niet worden bijgewerkt.");
      }
    });
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="cb-eyebrow">Aan de slag</div>
          <h2 className="mt-2 cb-section-title">Opdrachten bij deze les</h2>
        </div>
        <p className="cb-caption">
          {completedCount}/{actions.length} afgerond
        </p>
      </div>

      <ul className="mt-5 divide-y divide-[var(--border)]">
        {actions.map((action, index) => {
          const isCompleted = completed[index] === true;
          return (
            <li key={`${index}-${action}`}>
              <button
                type="button"
                onClick={() => toggle(index)}
                disabled={isPending}
                className="flex w-full items-start gap-3 py-4 text-left disabled:cursor-wait"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors ${
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-[var(--border)] bg-[var(--background)] text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span
                  className={`text-sm leading-relaxed transition-colors ${
                    isCompleted
                      ? "text-[var(--muted)] line-through"
                      : "font-medium text-[var(--foreground)]"
                  }`}
                >
                  {action}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
