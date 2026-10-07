export default function LoadingMarketPost() {
  return <div className="market-post" aria-busy="true" aria-label="Marktinzicht laden">
    <div className="h-6 w-40 animate-pulse rounded bg-[var(--surface-hover)]" />
    <div className="mt-8 h-24 max-w-3xl animate-pulse rounded bg-[var(--surface-hover)]" />
    <div className="mt-6 h-14 w-64 animate-pulse rounded bg-[var(--surface-hover)]" />
    <div className="mt-9 aspect-video animate-pulse rounded-lg bg-[var(--surface-hover)]" />
    <span className="sr-only" role="status">Marktinzicht laden…</span>
  </div>;
}
