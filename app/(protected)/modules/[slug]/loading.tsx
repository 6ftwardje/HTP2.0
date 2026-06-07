export default function ModuleDetailLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-4 w-24 bg-stone-100 rounded" />
      <div className="cb-panel p-6">
        <div className="h-4 w-36 bg-stone-100 rounded" />
        <div className="mt-3 h-10 w-[75%] bg-stone-200 rounded-lg" />
        <div className="mt-3 h-4 w-full max-w-3xl bg-stone-100 rounded" />
      </div>

      <div className="h-4 w-28 bg-stone-100 rounded" />
      <div className="mt-2 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="cb-panel p-5">
            <div className="flex gap-4">
              <div className="h-9 w-9 rounded-xl bg-stone-200" />
              <div className="flex-1">
                <div className="h-4 w-56 bg-stone-200 rounded" />
                <div className="mt-2 h-4 w-[80%] bg-stone-100 rounded" />
                <div className="mt-3 h-5 w-24 bg-stone-100 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="cb-panel p-6 sm:p-7">
        <div className="h-4 w-28 bg-stone-100 rounded" />
        <div className="mt-3 h-8 w-[45%] bg-stone-200 rounded" />
        <div className="mt-3 h-4 w-full max-w-2xl bg-stone-100 rounded" />
        <div className="mt-5 h-11 w-56 bg-stone-200 rounded-xl" />
      </div>
    </div>
  );
}
