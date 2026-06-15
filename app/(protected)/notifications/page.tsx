import Link from "next/link";
import {
  markNotificationsRead,
  markOneNotificationRead,
} from "@/app/actions/mentor-chat";
import { PageHeader } from "@/components/layout/PageHeader";
import { listMyNotifications } from "@/lib/notifications";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function NotificationsPage() {
  const { notifications, missingMigration } = await listMyNotifications();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div>
      <PageHeader
        eyebrow="Meldingen"
        title="Notification center"
        description="Nieuwe mentorantwoorden en platformupdates verschijnen hier. E-mail en push kunnen later via dezelfde voorkeuren worden aangesloten."
        actions={
          unreadCount > 0 ? (
            <form action={markNotificationsRead}>
              <button className="cb-btn cb-btn-secondary px-4 py-2 text-sm" type="submit">
                Alles gelezen
              </button>
            </form>
          ) : null
        }
      />

      {missingMigration ? (
        <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">
            Notificaties zijn bijna klaar
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Pas de nieuwe Supabase migration toe om het notification center te activeren.
          </p>
        </section>
      ) : notifications.length === 0 ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">
            Geen meldingen
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Zodra Rousso antwoordt of er nieuwe platformupdates zijn, zie je ze hier.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {notifications.map((notification) => {
              const event = notification.event;
              const unread = !notification.read_at;
              return (
                <li
                  key={notification.id}
                  className={`p-5 ${unread ? "bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]" : ""}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {unread && (
                          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-label="Ongelezen" />
                        )}
                        <h2 className="font-bold text-[var(--foreground)]">
                          {event?.title ?? "Melding"}
                        </h2>
                      </div>
                      {event?.body && (
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                          {event.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
                        {formatDateTime(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {event?.href && (
                        <Link
                          href={event.href}
                          className="cb-btn cb-btn-primary px-4 py-2 text-sm"
                        >
                          Open
                        </Link>
                      )}
                      {unread && (
                        <form action={markOneNotificationRead.bind(null, notification.id)}>
                          <button
                            type="submit"
                            className="cb-btn cb-btn-secondary px-4 py-2 text-sm"
                          >
                            Gelezen
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
