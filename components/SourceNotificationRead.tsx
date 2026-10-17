"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readSourceNotifications } from "@/app/actions/notifications";
import type { NotificationSource } from "@/lib/notification-policy";

/** Mount only after the page's access gate. RSC/link prefetch never runs effects. */
export function SourceNotificationRead({ targets }: { targets: NotificationSource[] }) {
  const key = JSON.stringify(targets), router = useRouter();
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (key === "[]") return;
    let active = true;
    readSourceNotifications(JSON.parse(key)).then((result) => {
      if (!active) return;
      if (!result.success) setError(result.error);
      else { setError(null); if (result.changed) router.refresh(); }
    }).catch(() => { if (active) setError("De gelezenstatus kon niet worden bijgewerkt. Probeer opnieuw."); });
    return () => { active = false; };
  }, [key, attempt, router]);
  return error ? <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--foreground)]">
    <p>{error}</p><button type="button" onClick={() => setAttempt((n) => n+1)} className="min-h-11 rounded px-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--accent)]">Opnieuw proberen</button>
  </div> : null;
}
