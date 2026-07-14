import { AdminContentManager } from "@/components/admin/AdminContentManager";
import { listModuleVideoBlocksAdmin } from "@/lib/admin/videos";

export default async function AdminVideosPage() {
  const blocks = await listModuleVideoBlocksAdmin();
  const lessons = blocks.flatMap((block) => block.lessons);

  const readyCount = lessons.filter(
    (lesson) => lesson.video_provider === "mux" && lesson.mux_status === "ready"
  ).length;
  const processingCount = lessons.filter(
    (lesson) => lesson.video_provider === "mux" && lesson.mux_status === "preparing"
  ).length;
  const noVideoCount = lessons.filter(
    (lesson) => lesson.video_provider === "mux" && !lesson.mux_upload_id
  ).length;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="cb-eyebrow">Admin / Videos</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-normal text-[var(--foreground)] sm:text-3xl">
            Modules, lessons & media
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Manage course structure, lesson order, thumbnails and Mux uploads.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="cb-badge cb-badge-completed">{readyCount} ready</span>
          <span className="cb-badge cb-badge-available">{processingCount} processing</span>
          <span className="cb-badge cb-badge-locked">{noVideoCount} no video</span>
          <span className="cb-badge cb-badge-available">{lessons.length} lessons</span>
        </div>
      </header>

      <AdminContentManager blocks={blocks} />
    </div>
  );
}
