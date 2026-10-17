"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { loadChatProfile } from "@/app/actions/mentor-chat";
import { chatInitials, chatProfileRole, type ChatProfile } from "@/lib/chat-profiles";
import { useChatPresence } from "@/lib/chat-presence";
import styles from "./ChatWorkspace.module.css";

const PeopleContext = createContext<{ profiles: Map<string, ChatProfile>; open: (id: string) => void; remember: (profiles: ChatProfile[]) => void }>({ profiles: new Map(), open: () => {}, remember: () => {} });

export function useChatPerson(studentId: string | null) {
  return useContext(PeopleContext).profiles.get(studentId ?? "");
}

export function useRememberChatProfiles() {
  return useContext(PeopleContext).remember;
}

export function ChatPeople({ profiles, children }: { profiles: ChatProfile[]; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyProfiles, setHistoryProfiles] = useState<ChatProfile[]>([]);
  const people = useMemo(() => new Map([...historyProfiles, ...profiles].map((person) => [person.studentId, person])), [historyProfiles, profiles]);
  const remember = useCallback((additional: ChatProfile[]) => {
    setHistoryProfiles((current) => [...new Map([...current, ...additional].map((person) => [person.studentId, person])).values()]);
  }, []);
  const presence = useChatPresence(selectedId ? [selectedId] : []);

  async function open(id: string) {
    const attempt = ++request.current;
    setSelectedId(id);
    setProfile(null);
    setError(null);
    setLoading(true);
    if (!dialog.current?.open) dialog.current?.showModal();
    try {
      const result = await loadChatProfile(id);
      if (attempt !== request.current) return;
      if (result.success) setProfile(result.profile);
      else setError(result.error);
    } catch {
      if (attempt === request.current) setError("Profiel laden is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      if (attempt === request.current) setLoading(false);
    }
  }

  useEffect(() => () => { request.current++; }, []);

  return <PeopleContext.Provider value={{ profiles: people, open, remember }}>
    {children}
    <dialog ref={dialog} className={styles.profileDialog} aria-labelledby="chat-profile-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} onClose={() => { request.current++; setSelectedId(null); setProfile(null); }}>
      <div className={styles.profileTop}><h2 id="chat-profile-title" className={styles.heading}>Gebruikersprofiel</h2><button type="button" className={styles.textButton} onClick={() => dialog.current?.close()}>Sluiten</button></div>
      <div className={styles.profileContent} aria-busy={loading}>
        {loading && <p className={styles.profileStatus} role="status">Profiel laden…</p>}
        {error && <div role="alert"><p className={styles.error}>{error}</p><button type="button" className={styles.textButton} onClick={() => selectedId && open(selectedId)}>Opnieuw proberen</button></div>}
        {profile && <><ChatAvatar profile={profile} size="large"/><h3 className={styles.profileName}>{profile.displayName}</h3><p className={styles.profileStatus}>{chatProfileRole(profile.role)}</p><p className={styles.profileStatus}>{presence.status === "ready" ? presence.isOnline(profile.studentId) ? "Online" : "Offline" : "Status niet beschikbaar"}</p></>}
      </div>
    </dialog>
  </PeopleContext.Provider>;
}

export function ChatProfileName({ studentId, children, className }: { studentId: string; children: ReactNode; className?: string }) {
  const { open } = useContext(PeopleContext);
  return <button type="button" className={`${styles.profileLink} ${className ?? ""}`} onClick={() => open(studentId)} aria-label={`Profiel van ${typeof children === "string" ? children : "gebruiker"} bekijken`}>{children}</button>;
}

export function ChatAvatar({ profile, studentId, name = "Gebruiker", size = "normal", showPresence = true }: { profile?: ChatProfile; studentId?: string | null; name?: string; size?: "small" | "normal" | "large"; showPresence?: boolean }) {
  const person = useChatPerson(studentId ?? null);
  const resolved = profile ?? person;
  const id = resolved?.studentId ?? studentId;
  const path = resolved?.avatarPath;
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const presence = useChatPresence(showPresence && id ? [id] : []);
  const online = Boolean(id && presence.isOnline(id));
  return <span className={`${styles.personAvatar} ${size === "small" ? styles.smallAvatar : size === "large" ? styles.largeAvatar : ""}`}>
    {path && path !== failedPath ? <>
      {/* Private account photos use the authenticated storage route. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/avatars/${path}`} alt="" width={size === "large" ? 80 : size === "small" ? 30 : 40} height={size === "large" ? 80 : size === "small" ? 30 : 40} onError={() => setFailedPath(path)}/>
    </> : <span aria-hidden="true">{chatInitials(resolved?.displayName ?? name)}</span>}
    {showPresence && online && <span className={styles.onlineDot} role="img" aria-label="Online"/>}
  </span>;
}
