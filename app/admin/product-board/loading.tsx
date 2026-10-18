export default function LoadingProductBoard() {
  return <div aria-busy="true" aria-label="Productbord laden" className="space-y-6"><h1 className="text-3xl font-bold">Productbord</h1><p className="text-[var(--muted)]">De voortgang wordt opgehaald…</p><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 rounded-xl bg-[var(--surface-subtle)]" />)}</div></div>;
}
