"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

type WatchTable = {
  table: string;
  event?: ChangeEvent;
  filter?: string;
};

function useDebouncedRefresh(delayMs = 180) {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      router.refresh();
    }, delayMs);
  }, [delayMs, router]);
}

export function usePostgresRealtimeRefresh({
  channelName,
  enabled = true,
  tables,
}: {
  channelName: string;
  enabled?: boolean;
  tables: WatchTable[];
}) {
  const refresh = useDebouncedRefresh();
  const tableKey = useMemo(() => JSON.stringify(tables), [tables]);

  useEffect(() => {
    const watchedTables = JSON.parse(tableKey) as WatchTable[];
    if (!enabled || tables.length === 0) return;

    const supabase = createClient();
    const channel = supabase.channel(channelName);

    for (const table of watchedTables) {
      channel.on(
        "postgres_changes",
        {
          event: table.event ?? "*",
          schema: "public",
          table: table.table,
          filter: table.filter,
        },
        refresh
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, refresh, tableKey, tables.length]);
}

export function useConversationRealtime(threadId: string | null) {
  const tables = useMemo(
    () =>
      threadId
        ? [
            {
              table: "conversation_messages",
              event: "INSERT" as const,
              filter: `thread_id=eq.${threadId}`,
            },
            {
              table: "conversation_threads",
              event: "UPDATE" as const,
              filter: `id=eq.${threadId}`,
            },
          ]
        : [],
    [threadId]
  );

  usePostgresRealtimeRefresh({
    channelName: threadId ? `conversation:${threadId}` : "conversation:none",
    enabled: Boolean(threadId),
    tables,
  });
}

export function useMentorInboxRealtime(selectedThreadId: string | null) {
  const tables = useMemo(
    () => [
      { table: "conversation_threads", event: "INSERT" as const },
      { table: "conversation_threads", event: "UPDATE" as const },
      { table: "conversation_messages", event: "INSERT" as const },
    ],
    []
  );

  usePostgresRealtimeRefresh({
    channelName: selectedThreadId
      ? `mentor-inbox:${selectedThreadId}`
      : "mentor-inbox",
    tables,
  });
}

export function useNotificationsRealtime(studentId: string | null) {
  const tables = useMemo(
    () =>
      studentId
        ? [
            {
              table: "notification_recipients",
              event: "*" as const,
              filter: `student_id=eq.${studentId}`,
            },
          ]
        : [],
    [studentId]
  );

  usePostgresRealtimeRefresh({
    channelName: studentId ? `notifications:${studentId}` : "notifications:none",
    enabled: Boolean(studentId),
    tables,
  });
}
