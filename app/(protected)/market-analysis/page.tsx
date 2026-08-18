import { MarketAnalysisLibrary } from "@/components/MarketAnalysisLibrary";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getWeeklyUpdateViewsByIds,
  listPublishedMarketUpdates,
  listPublishedWeeklyOutlooks,
} from "@/lib/weekly-updates";
import { ensureCurrentStudent } from "@/lib/students";

export default async function MarketAnalysisPage() {
  const { student } = await ensureCurrentStudent();
  if (!student) return null;

  const [outlooks, marketUpdates] = await Promise.all([
    listPublishedWeeklyOutlooks(24),
    listPublishedMarketUpdates(72),
  ]);
  const updates = [...outlooks, ...marketUpdates];
  const viewMap = await getWeeklyUpdateViewsByIds(
    student.id,
    updates.map((update) => update.id)
  );

  return (
    <div>
      <PageHeader
        eyebrow="Videoanalyses"
        title="Marktanalyse"
        description="Begin je week met de weekly outlook en volg tussentijdse ontwikkelingen per markt."
      />
      <MarketAnalysisLibrary
        updates={updates}
        watchedIds={Array.from(viewMap.values())
          .filter((view) => view.watched)
          .map((view) => view.weekly_update_id)}
      />
    </div>
  );
}
