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
      <h4 className="cb-caption text-xs font-bold uppercase tracking-wider">{title}</h4>
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
  const [collapsed, setCollapsed] = useState(false);

  const onGenerate = () => {
    setError(null);
    startTransition(async () => {
      const res = await adminGenerateMentorSummary(studentId);
      if (!res.success) {
        setError(res.error ?? "Genereren mislukt.");
        return;
      }
      setCollapsed(false);
      router.refresh();
    });
  };

  const data = summary?.summary ?? null;

  return (
    <section className="cb-panel p-6" aria-labelledby="mentor-copilot-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="mentor-copilot-heading" className="cb-section-title flex items-center gap-2">
            Mentor Copilot
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="h-[1.35em] w-[1.35em] text-white"
            >
              <path d="M10 5 Q10 13 18 13 Q10 13 10 21 Q10 13 2 13 Q10 13 10 5 Z" />
              <path d="M18 2 Q18 6 22 6 Q18 6 18 10 Q18 6 14 6 Q18 6 18 2 Z" />
            </svg>
          </h2>
          <p className="cb-body mt-2 max-w-prose">
            AI-samenvatting ter voorbereiding van een gesprek.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Uitklappen" : "Inklappen"}
              aria-expanded={!collapsed}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--background)_80%,var(--card)_20%)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending}
            className="cb-btn cb-btn-primary whitespace-nowrap"
          >
            {pending ? "Bezig..." : data ? "Vernieuwen" : "Genereer mentor summary"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {data ? (
        collapsed ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">{data.status || "—"}</p>
            {summary && (
              <span className="cb-caption text-xs">{formatDateTime(summary.updated_at)}</span>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {/* Blok 1: samenvatting van waar de student staat */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Samenvatting
              </h3>
              <div>
                <h4 className="cb-caption text-xs font-bold uppercase tracking-wider">Status</h4>
                <p className="mt-1 font-semibold text-[var(--foreground)]">{data.status || "—"}</p>
              </div>
              <div>
                <h4 className="cb-caption text-xs font-bold uppercase tracking-wider">Voortgang</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                  {data.voortgang || "—"}
                </p>
              </div>
              <SummaryList title="Risico's" items={data.risicos} />
            </div>

            {/* Blok 2: concrete aanbevelingen voor het gesprek, visueel afgescheiden */}
            <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_82%,var(--card)_18%)] p-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Aanbevelingen voor de call
              </h3>
              {data.call_focus.length === 0 && data.open_vragen.length === 0 ? (
                <p className="cb-caption">Geen specifieke aanbevelingen.</p>
              ) : (
                <>
                  <SummaryList title="Gespreksfocus" items={data.call_focus} />
                  <SummaryList title="Open vragen" items={data.open_vragen} />
                </>
              )}
            </div>

            {summary && (
              <p className="cb-caption text-xs">
                Gegenereerd op {formatDateTime(summary.updated_at)}
                {summary.model ? ` · ${summary.model}` : ""}
              </p>
            )}
          </div>
        )
      ) : (
        <p className="cb-caption mt-4">
          Nog geen samenvatting. Klik op de knop om er een te genereren op basis van de intake,
          voortgang, examens en mentor-notities van deze student.
        </p>
      )}
    </section>
  );
}
