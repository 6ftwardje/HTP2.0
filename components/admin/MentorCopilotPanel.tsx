"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminGenerateMentorSummary } from "@/app/actions/admin/ai";
import type { AiStudentSummary } from "@/lib/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="cb-caption text-xs font-bold uppercase tracking-wider">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--foreground)]">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function MentorCopilotPanel({
  studentId,
  summary,
}: {
  studentId: string;
  summary: AiStudentSummary | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onGenerate = () => {
    setError(null);
    startTransition(async () => {
      const res = await adminGenerateMentorSummary(studentId);
      if (!res.success) {
        setError(res.error ?? "Genereren mislukt.");
        return;
      }
      router.refresh();
    });
  };

  const data = summary?.summary ?? null;

  return (
    <section className="cb-panel p-6" aria-labelledby="mentor-copilot-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="mentor-copilot-heading" className="cb-section-title">
            Mentor Copilot
          </h2>
          <p className="cb-body mt-2 max-w-prose">
            AI-samenvatting ter voorbereiding van een gesprek. Educatieve context, geen financieel
            advies. Mentor-notities blijven de menselijke bron van waarheid.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={pending}
          className="cb-btn cb-btn-primary whitespace-nowrap"
        >
          {pending
            ? "Bezig..."
            : data
              ? "Vernieuwen"
              : "Genereer mentor summary"}
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {data ? (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="cb-caption text-xs font-bold uppercase tracking-wider">Status</h3>
            <p className="mt-1 font-semibold text-[var(--foreground)]">{data.status || "—"}</p>
          </div>
          <div>
            <h3 className="cb-caption text-xs font-bold uppercase tracking-wider">Voortgang</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
              {data.voortgang || "—"}
            </p>
          </div>
          <SummaryList title="Risico's" items={data.risicos} />
          <SummaryList title="Gespreksfocus" items={data.call_focus} />
          <SummaryList title="Open vragen" items={data.open_vragen} />

          {summary && (
            <p className="cb-caption text-xs">
              Gegenereerd op {formatDateTime(summary.updated_at)}
              {summary.model ? ` · ${summary.model}` : ""}
            </p>
          )}
        </div>
      ) : (
        <p className="cb-caption mt-4">
          Nog geen samenvatting. Klik op de knop om er een te genereren op basis van de
          intake, voortgang, examens en mentor-notities van deze student.
        </p>
      )}
    </section>
  );
}
