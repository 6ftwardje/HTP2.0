"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChatMentor } from "@/lib/chat-profiles";
import { ChatAvatar } from "./ChatPeople";
import styles from "./ChatWorkspace.module.css";

export function MentorSelector({ mentors, selectedId }: { mentors: ChatMentor[]; selectedId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <nav className={styles.mentorMenu} aria-label="Kies je mentor" aria-busy={pending}>
    <span className={styles.mentorMenuLabel}>Je mentoren</span>
    <div className={styles.mentorOptions}>{mentors.map((mentor) => <Link key={mentor.studentId} href={`/mentor?mentor=${mentor.studentId}`} scroll={false} prefetch={false} className={`${styles.mentorOption} ${selectedId === mentor.studentId ? styles.activeMentor : ""}`} aria-current={selectedId === mentor.studentId ? "page" : undefined} onClick={(event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      startTransition(() => router.push(`/mentor?mentor=${mentor.studentId}`, { scroll: false }));
    }}><ChatAvatar profile={mentor}/><span>{mentor.displayName}</span>{mentor.unreadCount > 0 && <span className={styles.unreadCount} aria-label={`${mentor.unreadCount} ongelezen berichten`}>{mentor.unreadCount > 99 ? "99+" : mentor.unreadCount}</span>}</Link>)}</div>
    {pending && <span className={styles.mentorLoading} role="status">Gesprek laden…</span>}
  </nav>;
}
