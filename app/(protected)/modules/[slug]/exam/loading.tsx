export default function ExamLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-4 w-36 bg-stone-100 rounded" />
      <div className="h-12 w-[70%] bg-stone-200 rounded-lg" />
      <div className="h-4 w-full max-w-2xl bg-stone-100 rounded" />

      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="cb-panel p-5">
            <div className="h-4 w-36 bg-stone-100 rounded" />
            <div className="mt-3 h-6 w-[85%] bg-stone-200 rounded" />
            <div className="mt-4 space-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div
                  key={j}
                  className="h-14 bg-stone-50 border border-stone-200/70 rounded-xl"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="h-11 w-56 bg-stone-200 rounded-xl" />
        <div className="h-4 w-64 bg-stone-100 rounded" />
      </div>
    </div>
  );
}
