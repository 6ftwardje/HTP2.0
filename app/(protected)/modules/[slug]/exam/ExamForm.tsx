"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitExam } from "@/app/actions/exam";
import type { PublicExamAttempt } from "@/lib/types";

type Props = {
  attempt: PublicExamAttempt;
  passingScore: number;
  moduleSlug: string;
  moduleTitle: string;
};

export function ExamForm({
  attempt,
  passingScore,
  moduleSlug,
  moduleTitle,
}: Props) {
  const router = useRouter();
  const questions = attempt.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = questions[index];
  const currentAnswer = answers[current.id] ?? null;
  const answeredCount = useMemo(
    () => questions.filter((q) => Number.isInteger(answers[q.id])).length,
    [answers, questions]
  );
  const allAnswered = answeredCount === questions.length;
  const canContinue = currentAnswer != null;
  const isLast = index === questions.length - 1;
  const progress = ((index + 1) / questions.length) * 100;
  const canSubmit = allAnswered && !submitting && !result;

  function selectAnswer(optionId: number) {
    setAnswers((prev) => ({ ...prev, [current.id]: optionId }));
    setError(null);
  }

  function goNext() {
    if (!canContinue) return;
    setIndex((prev) => Math.min(questions.length - 1, prev + 1));
  }

  function goPrevious() {
    setIndex((prev) => Math.max(0, prev - 1));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setError("Beantwoord alle vragen voordat je de toets indient.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const answersList = questions.map((q) => ({
      questionId: q.id,
      selectedOptionId: answers[q.id] ?? 0,
    }));

    submitExam(attempt.attemptId, answersList).then((res) => {
      setSubmitting(false);
      if (res.success && res.score != null && res.passed != null) {
        setResult({ score: res.score, passed: res.passed });
        router.refresh();
      } else {
        setError(res.error ?? "Indienen mislukt.");
      }
    });
  }

  if (result) {
    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-center">
        <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--background)_12%)] p-5 sm:p-7">
          <div className="cb-eyebrow">Resultaat</div>
          <h2 className="mt-4 text-2xl font-extrabold leading-tight text-[var(--foreground)] sm:text-[2rem]">
            Score: {result.score}%
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {result.passed
              ? `Je bent geslaagd voor ${moduleTitle}. Je volgende module komt nu vrij.`
              : `Je hebt ${passingScore}% nodig om te slagen. Neem de module rustig opnieuw door en probeer daarna opnieuw.`}
          </p>

          <div className="mt-6">
            {result.passed ? (
              <span className="cb-badge cb-badge-completed">Geslaagd</span>
            ) : (
              <span className="cb-badge cb-badge-locked">Niet geslaagd</span>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={`/modules/${moduleSlug}`}
              className="cb-btn cb-btn-secondary"
            >
              Terug naar module
            </Link>

            {result.passed ? (
              <Link href="/modules" className="cb-btn cb-btn-primary">
                Ga naar de volgende module
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  router.refresh();
                }}
                className="cb-btn cb-btn-primary"
              >
                Toets opnieuw maken
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full min-h-0 w-full flex-col justify-center"
    >
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
          <span>
            Vraag {index + 1} van {questions.length}
          </span>
          <span>{answeredCount}/{questions.length} beantwoord</span>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-sm bg-white/[0.08]">
          <div
            className="h-full rounded-sm bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <fieldset className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--background)_12%)] p-5 sm:p-7">
        <legend className="sr-only">Vraag {index + 1}</legend>
        <h1 className="text-2xl font-extrabold leading-tight text-[var(--foreground)] sm:text-[1.95rem]">
          {current.questionText}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Kies het antwoord dat volgens jou het beste klopt. Je kunt teruggaan
          zolang je de toets nog niet hebt ingediend.
        </p>

        <div className="mt-6 space-y-3">
          {current.options.map((option) => {
            const selected = currentAnswer === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectAnswer(option.id)}
                className={[
                  "flex w-full items-start justify-between gap-5 rounded-lg border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-[color-mix(in_oklab,var(--accent)_70%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_11%,var(--card))]"
                    : "border-[var(--border)] bg-white/[0.018] hover:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))]",
                ].join(" ")}
              >
                <span className="text-sm font-semibold leading-6 text-[var(--foreground)]">
                  {option.optionText}
                </span>
                <span
                  aria-hidden
                  className={[
                    "mt-1 h-4 w-4 shrink-0 rounded-full border",
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent)]"
                      : "border-[var(--border)]",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p
          className="mt-5 rounded-lg border border-[color-mix(in_oklab,#fca5a5_38%,var(--border))] bg-red-500/[0.08] px-4 py-3 text-sm font-semibold text-red-100"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goPrevious}
          disabled={index === 0 || submitting}
          className="cb-btn cb-btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Vorige
        </button>

        {isLast ? (
          <button
            type="submit"
            disabled={!canSubmit}
            className="cb-btn cb-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Toets indienen..." : "Toets indienen"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue || submitting}
            className="cb-btn cb-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Verder
          </button>
        )}
      </div>
    </form>
  );
}
