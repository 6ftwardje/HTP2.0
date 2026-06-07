export default function ModulesLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-4 w-44 bg-stone-200 rounded" />
      <div className="h-12 w-[65%] bg-stone-200 rounded-lg" />
      <div className="h-4 w-full max-w-2xl bg-stone-100 rounded" />

      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="cb-panel p-6">
            <div className="h-4 w-40 bg-stone-100 rounded" />
            <div className="mt-3 h-6 w-[55%] bg-stone-200 rounded" />
            <div className="mt-2 h-4 w-[90%] bg-stone-100 rounded" />
            <div className="mt-3 h-4 w-32 bg-stone-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
