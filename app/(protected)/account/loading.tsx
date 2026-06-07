export default function AccountLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-4 w-36 bg-stone-200 rounded" />
      <div className="h-10 w-64 bg-stone-200 rounded-lg" />
      <div className="h-4 w-full max-w-2xl bg-stone-100 rounded" />
      <div className="cb-panel p-6 sm:p-7 max-w-2xl">
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-full bg-stone-200" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-28 bg-stone-100 rounded" />
            <div className="h-6 w-56 bg-stone-200 rounded" />
            <div className="h-4 w-48 bg-stone-100 rounded" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-32 rounded-2xl bg-stone-100/70 border border-stone-200/70" />
          <div className="h-32 rounded-2xl bg-stone-100/70 border border-stone-200/70" />
        </div>
      </div>
    </div>
  );
}
