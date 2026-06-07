"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitExam } from "@/app/actions/exam";
import type { ExamQuestion } from "@/lib/types";

type Props = {
  examId: number;
  questions: ExamQuestion[];
  passingScore: number;
  moduleSlug: string;
  moduleTitle: string;
};

export function ExamForm({
  examId,
  questions,
  passingScore,
  moduleSlug,
  moduleTitle,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = questions.every((q) => answers[q.id]?.trim() !== "");
  const canSubmit = allAnswered && !submitting && !result;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const answersList = questions.map((q) => ({
      questionId: q.id,
      selectedAnswer: answers[q.id] ?? "",
    }));

    submitExam(examId, answersList).then((res) => {
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
      <div className="cb-panel p-8">
        <div className="cb-eyebrow">Resultaat</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--foreground)] tracking-tight">
          Score: {result.score}%
        </h2>

        <div className="mt-3">
          {result.passed ? (
            <span className="cb-badge cb-badge-completed">Geslaagd</span>
          ) : (
            <span className="cb-badge cb-badge-locked">
              Niet geslaagd (je hebt {passingScore}% nodig)
            </span>
          )}
        </div>

        <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <Link
            href={`/modules/${moduleSlug}`}
            className="cb-btn cb-btn-secondary"
          >
            Terug naar module
          </Link>

          {result.passed && (
            <Link href="/modules" className="cb-btn cb-btn-primary">
              Ga naar de volgende module
            </Link>
          )}

          {!result.passed && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              className="cb-btn cb-btn-primary"
            >
              Toets opnieuw maken
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-6">
        {questions.map((q, index) => (
          <fieldset
            key={q.id}
            className="cb-panel p-5"
          >
            <legend className="cb-eyebrow">
              Vraag {index + 1} van {questions.length}
            </legend>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)] leading-snug">
              {q.question}
            </p>
            <div className="mt-4 space-y-2">
              {q.options.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:bg-[color-mix(in_oklab,var(--card)_85%,var(--muted)_15%)] has-[:checked]:border-[var(--foreground)] has-[:checked]:bg-[color-mix(in_oklab,var(--card)_78%,var(--muted)_22%)]"
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={option}
                    checked={answers[q.id] === option}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: option }))
                    }
                    className="mt-0.5 h-4 w-4 border-[var(--border)] text-[var(--foreground)] focus:ring-[color-mix(in_oklab,var(--foreground)_35%,transparent)]"
                  />
                  <span className="font-medium text-[var(--foreground)]">
                    {option}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {error && (
        <p className="cb-caption text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="cb-btn cb-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Indienen..." : "Toets indienen"}
        </button>
        {!allAnswered && (
          <p className="self-center cb-caption">
            Beantwoord alle vragen om in te dienen.
          </p>
        )}
      </div>
    </form>
  );
}
