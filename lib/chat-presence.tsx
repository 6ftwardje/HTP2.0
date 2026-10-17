"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 25_000;
const POLL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;
export const CHAT_PRESENCE_TTL_MS = 65_000;

export type ChatPresenceStatus = "loading" | "ready" | "offline" | "unavailable";
export type ChatPresenceRow = { student_id: string; last_seen_at: string; server_now: string };

/** Convert server timestamps to a local deadline without trusting the device clock. */
export function chatPresenceDeadline(row: ChatPresenceRow, receivedAt: number, requestDurationMs = 0): number {
  const lastSeen = Date.parse(row.last_seen_at);
  const serverNow = Date.parse(row.server_now);
  if (!Number.isFinite(lastSeen) || !Number.isFinite(serverNow)) return receivedAt;
  const remaining = Math.max(0, Math.min(CHAT_PRESENCE_TTL_MS, CHAT_PRESENCE_TTL_MS - (serverNow - lastSeen)));
  // Conservatively account for a delayed response instead of extending a stale lease.
  return receivedAt + Math.max(0, remaining - Math.max(0, requestDurationMs));
}

type PresenceContext = {
  watch: (key: string, studentIds: string[]) => () => void;
  isOnline: (studentId: string | null | undefined) => boolean;
  status: ChatPresenceStatus;
};
const PresenceContext = createContext<PresenceContext | null>(null);

function presenceIds(studentIds: readonly (string | null | undefined)[]) {
  return [...new Set(studentIds.filter((id): id is string => Boolean(id)))].sort();
}

/** Mounted once for the authenticated shell, so activity outside chat counts too. */
export function ChatPresenceProvider({ currentStudentId, children }: {
  currentStudentId: string;
  children: React.ReactNode;
}) {
  const registrations = useRef(new Map<string, string[]>());
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<ChatPresenceStatus>("loading");
  const [now, setNow] = useState(() => Date.now());
  const idsKey = JSON.stringify(watchedIds);

  const watch = useCallback((key: string, studentIds: string[]) => {
    function updateIds() {
      const next = presenceIds([...registrations.current.values()].flat());
      setWatchedIds((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    }
    registrations.current.set(key, studentIds);
    updateIds();
    return () => { registrations.current.delete(key); updateIds(); };
  }, []);

  useEffect(() => {
    // Only update consumers when a lease actually expires, rather than every second.
    const nextExpiry = Math.min(...Object.values(deadlines).filter((deadline) => deadline > now));
    if (!Number.isFinite(nextExpiry)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 1);
    return () => clearTimeout(timer);
  }, [deadlines, now]);

  useEffect(() => {
    const supabase = createClient();
    // Each mounted tab owns its lease. Closing one tab cannot remove another tab's presence.
    const sessionId = crypto.randomUUID();
    let stopped = false;
    let suspended = false;
    let signedOut = false;
    let pending = false;
    let request: AbortController | null = null;

    async function heartbeat() {
      if (stopped || suspended || signedOut || pending || !navigator.onLine) return;
      pending = true;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        await supabase.rpc("chat_presence_heartbeat", { p_session_id: sessionId }).abortSignal(controller.signal);
      } catch {
        // The last successful lease expires server-side even when the connection disappears.
      } finally {
        clearTimeout(timeout);
        if (request === controller) request = null;
        pending = false;
      }
    }

    function leave() {
      request?.abort();
      // Best effort on navigation/unload; the 65-second lease also covers crashes and lost connections.
      void Promise.resolve(supabase.rpc("chat_presence_leave", { p_session_id: sessionId })).catch(() => {});
    }
    function pageHide() { suspended = true; leave(); }
    function pageShow() { suspended = false; void heartbeat(); }
    function offline() { request?.abort(); setStatus("offline"); }
    function online() { void heartbeat(); }
    function visible() { if (document.visibilityState === "visible") void heartbeat(); }

    void heartbeat();
    const timer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        signedOut = true;
        setDeadlines({});
        // Avoid calling Supabase asynchronously inside its auth callback lock.
        setTimeout(leave, 0);
      }
    });
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", pageShow);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);

    return () => {
      stopped = true;
      clearInterval(timer);
      authListener.subscription.unsubscribe();
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
      leave();
    };
  }, [currentStudentId]);

  useEffect(() => {
    const ids = JSON.parse(idsKey) as string[];
    if (ids.length === 0) { setDeadlines({}); setStatus(navigator.onLine ? "ready" : "offline"); return; }
    const supabase = createClient();
    let stopped = false;
    let pending = false;
    let request: AbortController | null = null;
    setStatus(navigator.onLine ? "loading" : "offline");

    async function refresh() {
      if (stopped || pending) return;
      if (!navigator.onLine) { setStatus("offline"); return; }
      pending = true;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const startedAt = Date.now();
      try {
        // The RPC checks every requested student against the caller's chat/profile permissions.
        const batches = Array.from({ length: Math.ceil(ids.length / 200) }, (_, index) => ids.slice(index * 200, (index + 1) * 200));
        const results = await Promise.all(batches.map((batch) =>
          supabase.rpc("list_chat_presence", { p_student_ids: batch }).abortSignal(controller.signal)
        ));
        if (stopped) return;
        if (results.some((result) => result.error)) { setStatus(navigator.onLine ? "unavailable" : "offline"); return; }
        const receivedAt = Date.now();
        const next: Record<string, number> = {};
        for (const row of results.flatMap((result) => result.data ?? []) as ChatPresenceRow[]) {
          if (ids.includes(row.student_id)) next[row.student_id] = chatPresenceDeadline(row, receivedAt, receivedAt - startedAt);
        }
        setDeadlines(next);
        setNow(receivedAt);
        setStatus(navigator.onLine ? "ready" : "offline");
      } catch {
        if (!stopped) setStatus(navigator.onLine ? "unavailable" : "offline");
      } finally {
        clearTimeout(timeout);
        if (request === controller) request = null;
        pending = false;
      }
    }
    function catchUp() { if (document.visibilityState === "visible") void refresh(); }
    function offline() { request?.abort(); setStatus("offline"); }
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    window.addEventListener("focus", catchUp);
    window.addEventListener("online", catchUp);
    window.addEventListener("pageshow", catchUp);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      stopped = true;
      request?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", catchUp);
      window.removeEventListener("online", catchUp);
      window.removeEventListener("pageshow", catchUp);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [currentStudentId, idsKey]);

  const isOnline = useCallback((studentId: string | null | undefined) => Boolean(
    studentId && status !== "offline" && (deadlines[studentId] ?? 0) > now
  ), [deadlines, now, status]);
  const value = useMemo(() => ({ watch, isOnline, status }), [watch, isOnline, status]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

/** Multiple avatars/profile panels share one authorized, batched presence lookup. */
export function useChatPresence(studentIds: readonly (string | null | undefined)[] = []) {
  const context = useContext(PresenceContext);
  const key = useId();
  const idsKey = JSON.stringify(presenceIds(studentIds));
  const watch = context?.watch;
  useEffect(() => watch?.(key, JSON.parse(idsKey) as string[]), [key, idsKey, watch]);
  return {
    isOnline: context?.isOnline ?? (() => false),
    status: context?.status ?? "unavailable" as ChatPresenceStatus,
  };
}
