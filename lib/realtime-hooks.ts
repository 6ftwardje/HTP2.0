"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";
type WatchTable = { table: string; event?: ChangeEvent; filter?: string };
export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

function useDebouncedRefresh(delayMs = 180) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; router.refresh(); }, delayMs);
  }, [delayMs, router]);
}

export function usePostgresRealtimeRefresh({ channelName, enabled = true, tables }: {
  channelName: string;
  enabled?: boolean;
  tables: WatchTable[];
}) {
  const refresh = useDebouncedRefresh();
  const tableKey = JSON.stringify(tables);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>(enabled ? "connecting" : "idle");

  useEffect(() => {
    const watchedTables = JSON.parse(tableKey) as WatchTable[];
    if (!enabled || watchedTables.length === 0) { setConnectionStatus("idle"); return; }
    const supabase = createClient();
    const channel = supabase.channel(channelName);
    let stopped = false;
    let hasSubscribed = false;
    let reconnecting = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let periodicTimer: ReturnType<typeof setInterval> | null = null;
    setConnectionStatus(navigator.onLine ? "connecting" : "offline");

    for (const table of watchedTables) channel.on("postgres_changes", {
      event: table.event ?? "*", schema: "public", table: table.table, filter: table.filter,
    }, refresh);

    channel.subscribe((status) => {
      if (stopped) return;
      if (status === "SUBSCRIBED") {
        setConnectionStatus("connected");
        // Close the server-query/subscription gap once, then catch up after reconnects.
        if (!hasSubscribed || reconnecting) refresh();
        hasSubscribed = true;
        reconnecting = false;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        reconnecting = true;
        setConnectionStatus(navigator.onLine ? "reconnecting" : "offline");
        // Supabase reconnects the subscription; fetch missed state during longer outages too.
        if (!retryTimer) retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!stopped && navigator.onLine && document.visibilityState === "visible") refresh();
        }, 5000);
      }
    });

    function catchUp() {
      if (!navigator.onLine) { setConnectionStatus("offline"); return; }
      if (document.visibilityState === "visible") refresh();
    }
    function offline() { setConnectionStatus("offline"); }
    function online() { setConnectionStatus(channel.state === "joined" ? "connected" : "reconnecting"); catchUp(); }
    window.addEventListener("focus", catchUp);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", catchUp);
    periodicTimer = setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") refresh();
    }, 60000);

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (periodicTimer) clearInterval(periodicTimer);
      window.removeEventListener("focus", catchUp);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", catchUp);
      void supabase.removeChannel(channel);
    };
  }, [channelName, enabled, refresh, tableKey]);

  return connectionStatus;
}

export function useConversationRealtime(threadId: string | null) {
  const tables = useMemo(() => threadId ? [
    { table: "conversation_messages", event: "INSERT" as const, filter: `thread_id=eq.${threadId}` },
    { table: "conversation_threads", event: "UPDATE" as const, filter: `id=eq.${threadId}` },
  ] : [], [threadId]);
  return usePostgresRealtimeRefresh({ channelName: threadId ? `conversation:${threadId}` : "conversation:none", enabled: Boolean(threadId), tables });
}

export function useMentorInboxRealtime(selectedThreadId: string | null) {
  const tables = useMemo(() => [
    { table: "conversation_threads", event: "INSERT" as const },
    { table: "conversation_threads", event: "UPDATE" as const },
    { table: "conversation_messages", event: "INSERT" as const },
  ], []);
  // Selection should not reconnect the inbox and create a refresh/resubscribe loop.
  void selectedThreadId;
  return usePostgresRealtimeRefresh({ channelName: "mentor-inbox", tables });
}

export function useNotificationsRealtime(studentId: string | null) {
  const tables = useMemo(() => studentId ? [
    { table: "notification_recipients", event: "*" as const, filter: `student_id=eq.${studentId}` },
  ] : [], [studentId]);
  return usePostgresRealtimeRefresh({ channelName: studentId ? `notifications:${studentId}` : "notifications:none", enabled: Boolean(studentId), tables });
}
