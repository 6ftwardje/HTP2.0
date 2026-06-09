import { PageHeader } from "@/components/layout/PageHeader";
import { AdminWeeklyUpdatesManager } from "@/components/admin/AdminWeeklyUpdatesManager";
import {
  listWeeklyUpdateMentorsAdmin,
  listWeeklyUpdatesAdmin,
} from "@/lib/admin/weekly-updates";

export default async function AdminWeeklyUpdatesPage() {
  const [updates, mentors] = await Promise.all([
    listWeeklyUpdatesAdmin(),
    listWeeklyUpdateMentorsAdmin(),
  ]);

  const readyCount = updates.filter(
    (update) => update.video_provider === "mux" && update.mux_status === "ready"
  ).length;
  const processingCount = updates.filter(
    (update) => update.video_provider === "mux" && update.mux_status === "preparing"
  ).length;
  const publishedCount = updates.filter((update) => update.is_published).length;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Weekly Updates" },
        ]}
        eyebrow="Premium content"
        title="Weekly updates"
        description="Upload market analysis videos, publish weekly mentor commentary, and prepare the archive for subscription access."
        meta={
          <span className="cb-caption">
            {publishedCount} published · {readyCount} ready · {processingCount} processing
          </span>
        }
      />

      <AdminWeeklyUpdatesManager updates={updates} mentors={mentors} />
    </div>
  );
}
