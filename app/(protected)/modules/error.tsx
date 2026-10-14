"use client";

import Link from "next/link";

export default function ModulesError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Modules tijdelijk niet beschikbaar
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        De modules konden niet worden geladen. Probeer het opnieuw.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" onClick={reset} className="cb-btn cb-btn-primary">
          Opnieuw proberen
        </button>
        <Link href="/dashboard" className="cb-btn cb-btn-secondary">
          Naar dashboard
        </Link>
      </div>
    </section>
  );
}
