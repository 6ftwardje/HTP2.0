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
  const uncategorizedCount = updates.filter(
    (update) => update.needs_review || !update.type
  ).length;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Marktinzicht" },
        ]}
        eyebrow="Video content"
        title="Marktinzicht"
        description="Beheer Weekvooruitblikken en Marktbreakdowns. Live marktsessies plan je via het livebeheer."
        meta={
          <span className="cb-caption">
            {publishedCount} gepubliceerd · {readyCount} klaar · {processingCount} in verwerking · {uncategorizedCount} controle nodig
          </span>
        }
      />

      <AdminWeeklyUpdatesManager updates={updates} mentors={mentors} />
    </div>
  );
}
