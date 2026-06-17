"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markNotificationsRead,
  markOneNotificationRead,
} from "@/app/actions/mentor-chat";

export type FloatingNotification = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  href: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 6 2 6 2 8H4c0-2 2-2 2-8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 20a3 3 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NotificationPopover({
  notifications,
  unreadCount,
}: {
  notifications: FloatingNotification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function markAll() {
    setError(null);
    startTransition(async () => {
      try {
        await markNotificationsRead();
        router.refresh();
      } catch {
        setError("Meldingen bijwerken mislukt.");
      }
    });
  }

  function openNotification(notification: FloatingNotification) {
    setError(null);
    setPendingId(notification.id);
    startTransition(async () => {
      try {
        if (!notification.read) {
          await markOneNotificationRead(notification.id);
        }
        setIsOpen(false);
        if (notification.href) {
          router.push(notification.href);
        } else {
          router.refresh();
        }
      } catch {
        setError("Melding openen mislukt.");
      } finally {
        setPendingId(null);
      }
    });
  }

  const cappedUnread = Math.min(unreadCount, 99);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 md:bottom-6 md:right-6"
    >
      <div className="relative pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} ongelezen meldingen`
              : "Meldingen openen"
          }
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_84%,var(--card)_16%)] text-[var(--foreground)] shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:bg-[color-mix(in_oklab,var(--background)_72%,var(--card)_28%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--accent)_55%,transparent)]"
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-[var(--background)] bg-[var(--accent)] px-1 text-[0.65rem] font-extrabold leading-none text-black">
              {cappedUnread}
            </span>
          )}
        </button>

        {isOpen && (
          <section
            role="dialog"
            aria-label="Meldingen"
            className="absolute bottom-14 right-0 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,var(--card)_12%)] text-[var(--foreground)] shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="text-sm font-extrabold">Meldingen</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {unreadCount > 0 ? `${unreadCount} ongelezen` : "Alles gelezen"}
                </p>
              </div>
              <button
                type="button"
                onClick={markAll}
                disabled={isPending || unreadCount === 0}
                className="rounded-md px-2 py-1 text-xs font-bold text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40"
              >
                Alles gelezen
              </button>
            </div>

            {error && (
              <p className="border-b border-[var(--border)] px-4 py-2 text-xs font-semibold text-red-500">
                {error}
              </p>
            )}

            {notifications.length > 0 ? (
              <div className="max-h-[min(420px,calc(100dvh-170px))] divide-y divide-[var(--border)] overflow-y-auto">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    disabled={pendingId === notification.id}
                    className="block w-full px-4 py-3 text-left transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                          )}
                          <h3 className="truncate text-sm font-bold text-[var(--foreground)]">
                            {notification.title}
                          </h3>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                          {notification.description || "Nieuwe update"}
                        </p>
                      </div>
                      <time className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {formatDate(notification.timestamp)}
                      </time>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-sm leading-6 text-[var(--muted)]">
                Geen meldingen op dit moment.
              </div>
            )}

            <div className="border-t border-[var(--border)] px-4 py-3">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="inline-flex text-sm font-bold text-[var(--foreground)] underline-offset-4 hover:underline"
              >
                Open notification center
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
