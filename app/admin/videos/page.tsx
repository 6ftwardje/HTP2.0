import { PageHeader } from "@/components/layout/PageHeader";
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

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Videos" },
        ]}
        eyebrow="Content"
        title="Modules, lessons & media"
        description="Create modules, add lessons, upload thumbnails to Supabase, upload lesson videos to Mux, and sync processing status."
        meta={
          <span className="cb-caption">
            {readyCount} ready · {processingCount} processing · {lessons.length} lessons
          </span>
        }
      />

      <AdminContentManager blocks={blocks} />
    </div>
  );
}
