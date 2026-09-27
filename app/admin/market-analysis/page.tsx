import { PageHeader } from "@/components/layout/PageHeader";
import { AdminWeeklyUpdatesManager } from "@/components/admin/AdminWeeklyUpdatesManager";
import { paidProductsEnabled } from "@/lib/billing";
import {
  listWeeklyUpdateMentorsAdmin,
  listWeeklyUpdatesAdmin,
} from "@/lib/admin/weekly-updates";

export default async function AdminMarketAnalysisPage({
  searchParams,
}: {
  searchParams?: Promise<{ update?: string }>;
}) {
  const [updates, mentors, params] = await Promise.all([
    listWeeklyUpdatesAdmin(),
    listWeeklyUpdateMentorsAdmin(),
    searchParams ? searchParams : Promise.resolve({} as { update?: string }),
  ]);
  const requestedUpdateId = Number(params.update);
  const initialUpdateId = Number.isInteger(requestedUpdateId) && requestedUpdateId > 0
    ? requestedUpdateId
    : null;

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
        eyebrow="Beheer"
        title="Marktinzicht"
        description="Publiceer tekstberichten, charts en video's. Live marktsessies plan je in het aparte beheer."
        meta={
          <span className="cb-caption">
            {publishedCount} gepubliceerd · {readyCount} klaar · {processingCount} in verwerking · {uncategorizedCount} controle nodig
          </span>
        }
      />

      <AdminWeeklyUpdatesManager updates={updates} mentors={mentors} initialUpdateId={initialUpdateId} paidProductsActive={paidProductsEnabled()} />
    </div>
  );
}
