import { PageHeader } from "@/components/layout/PageHeader";
import { AdminWeeklyUpdatesManager } from "@/components/admin/AdminWeeklyUpdatesManager";
import {
  listWeeklyUpdateMentorsAdmin,
  listWeeklyUpdatesAdmin,
} from "@/lib/admin/weekly-updates";

export default async function AdminMarketAnalysisPage() {
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
  const uncategorizedCount = updates.filter((update) => !update.type).length;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Marktanalyse" },
        ]}
        eyebrow="Video content"
        title="Marktanalyse"
        description="Upload weekly outlooks en actuele markt updates. Videotype en markt bepalen automatisch de plek in de ledenbibliotheek."
        meta={
          <span className="cb-caption">
            {publishedCount} gepubliceerd · {readyCount} klaar · {processingCount} in verwerking · {uncategorizedCount} niet gecategoriseerd
          </span>
        }
      />

      <AdminWeeklyUpdatesManager updates={updates} mentors={mentors} />
    </div>
  );
}
