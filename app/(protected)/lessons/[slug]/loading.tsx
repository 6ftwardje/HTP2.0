export default function LessonLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-4 w-40 bg-stone-100 rounded" />
      <div className="h-10 w-[78%] bg-stone-200 rounded-lg" />
      <div className="h-4 w-full max-w-3xl bg-stone-100 rounded" />

      <div className="cb-panel p-5">
        <div className="aspect-video w-full rounded-2xl bg-stone-200" />
      </div>

      <div className="h-11 w-52 bg-stone-200 rounded-xl" />

      <div className="border-t border-stone-200/70 pt-8">
        <div className="h-4 w-52 bg-stone-100 rounded" />
        <div className="mt-4 h-11 w-56 bg-stone-200 rounded-xl sm:ml-auto sm:mr-0" />
      </div>
    </div>
  );
}
