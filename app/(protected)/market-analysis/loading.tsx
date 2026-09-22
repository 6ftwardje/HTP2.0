export default function MarketInsightLoading() {
  return (
    <div aria-busy="true" aria-label="Marktinzicht laden" className="animate-pulse">
      <div className="h-3 w-36 rounded bg-[var(--border)]" />
      <div className="mt-4 h-10 w-64 rounded bg-[var(--border)]" />
      <div className="mt-4 h-4 max-w-xl rounded bg-[var(--border)]" />
      <div className="mt-10 grid overflow-hidden rounded-xl border border-[var(--border)] lg:grid-cols-2">
        <div className="aspect-video bg-[var(--surface-hover)]" />
        <div className="space-y-4 p-7">
          <div className="h-3 w-32 rounded bg-[var(--border)]" />
          <div className="h-8 w-4/5 rounded bg-[var(--border)]" />
          <div className="h-4 w-full rounded bg-[var(--border)]" />
          <div className="h-10 w-40 rounded bg-[var(--border)]" />
        </div>
      </div>
      <span className="sr-only">Marktinzicht wordt geladen…</span>
    </div>
  );
}
