import { MentorInbox } from "@/components/admin/MentorInbox";
import { getAdminMentorThreadDetail, listAdminMentorThreads, requireChatMentor } from "@/lib/mentor-chat";

type Props = { searchParams?: Promise<{ thread?: string; status?: string; q?: string; cursor?: string; view?: string }> };

export default async function MentorInboxPage({ searchParams }: Props) {
  const { actorStudent, access } = await requireChatMentor();
  const params = searchParams ? await searchParams : {};
  const status = params.status ?? "active";
  const q = params.q ?? "";
  const { rows, selectedThreadId, missingMigration, hasMore, nextCursor, error } = await listAdminMentorThreads({ status, q, selectedThreadId: params.thread, cursor: params.cursor });
  if (error) {
    const retryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string") retryParams.set(key, value);
    return <section className="flex h-full w-full flex-col items-center justify-center bg-[var(--card)] px-6 py-12 text-center" role="alert">
      <h1 className="text-xl font-semibold tracking-tight">Studentvragen konden niet worden geladen</h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">{error}</p>
      <a href={`/mentor-inbox?${retryParams}`} className="cb-btn cb-btn-primary mt-6">Opnieuw proberen</a>
    </section>;
  }
  const detail = params.view === "list" ? null : await getAdminMentorThreadDetail(selectedThreadId);
  if (missingMigration) {
    return <section className="flex h-full w-full flex-col items-center justify-center bg-[var(--card)] px-6 py-12 text-center"><h1 className="text-xl font-semibold tracking-tight">Studentvragen tijdelijk niet beschikbaar</h1><p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">We kunnen de gesprekken nu niet openen. Probeer het later opnieuw.</p></section>;
  }
  return <MentorInbox rows={rows} detail={detail} currentStudentId={actorStudent.id} mentorId={access.mentor?.studentId ?? ""} status={status} q={q} hasMore={hasMore} nextCursor={nextCursor} totalUnreadCount={access.unreadCount} chatEmailEnabled={process.env.CHAT_EMAIL_MODE === "live"}/>;
}
