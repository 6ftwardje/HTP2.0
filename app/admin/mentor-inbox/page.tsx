import { MentorInbox } from "@/components/admin/MentorInbox";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getAdminMentorThreadDetail,
  listAdminMentorThreads,
} from "@/lib/mentor-chat";

type Props = {
  searchParams?: Promise<{
    thread?: string;
    status?: string;
    q?: string;
  }>;
};

export default async function AdminMentorInboxPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const status = params.status ?? "active";
  const q = params.q ?? "";
  const { rows, selectedThreadId, missingMigration } = await listAdminMentorThreads({
    status,
    q,
    selectedThreadId: params.thread,
  });
  const detail = await getAdminMentorThreadDetail(selectedThreadId);
  const unreadCount = rows.reduce((sum, row) => sum + row.unread_for_mentor_count, 0);

  return (
    <div>
      <PageHeader
        title="Mentor-inbox"
        description="Beantwoord vragen van studenten en houd de context van eerdere gesprekken bij."
        meta={
          <div>
            <p className="font-bold text-[var(--foreground)]">{unreadCount} ongelezen</p>
            <p>{rows.length} gesprekken in deze weergave</p>
          </div>
        }
      />

      {missingMigration ? (
        <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">
            Mentor-inbox niet beschikbaar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Gesprekken zijn voor deze omgeving nog niet geactiveerd. Het technische team moet deze functie eerst inschakelen.
          </p>
        </section>
      ) : (
        <MentorInbox rows={rows} detail={detail} status={status} q={q} />
      )}
    </div>
  );
}
