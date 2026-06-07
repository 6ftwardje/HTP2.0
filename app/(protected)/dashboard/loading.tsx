export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-11 w-[58%] rounded-lg bg-stone-200" />

      <div className="mt-10 overflow-hidden rounded-3xl border border-stone-200 bg-white">
        <div className="grid lg:grid-cols-2">
          <div className="aspect-[16/9] min-h-[220px] bg-stone-200 lg:h-[360px]" />
          <div className="p-6 sm:p-8">
            <div className="h-3 w-28 rounded bg-stone-100" />
            <div className="mt-5 h-4 w-44 rounded bg-stone-100" />
            <div className="mt-3 h-9 w-[78%] rounded-lg bg-stone-200" />
            <div className="mt-5 h-4 w-full rounded bg-stone-100" />
            <div className="mt-2 h-4 w-[80%] rounded bg-stone-100" />
            <div className="mt-14 h-2 w-full rounded bg-stone-100" />
            <div className="mt-6 h-10 w-44 rounded-xl bg-stone-200" />
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="h-3 w-28 rounded bg-stone-100" />
        <div className="mt-3 h-7 w-48 rounded bg-stone-200" />
        <div className="mt-5 space-y-3">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="h-28 rounded-2xl border border-stone-200 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
