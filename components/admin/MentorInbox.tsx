"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminMarkMentorThreadRead, adminReplyToMentorThread, adminUpdateMentorThread, loadAdminMentorMessages } from "@/app/actions/admin/mentor-chat";
import type { AdminMentorThreadDetail, AdminMentorThreadRow } from "@/lib/mentor-chat";
import { useMentorInboxRealtime } from "@/lib/realtime-hooks";
import type { ConversationMessage } from "@/lib/types";
import { acknowledgedChatDraft, removeChatDraft, restoreChatDraft, saveChatDraft } from "@/lib/chat-message-state";
import { ChatIcon, ChatTranscript, ConnectionNotice, mergeMessages, MessageComposer, newChatDraft } from "@/components/mentor/ChatWorkspace";
import type { ChatDraft } from "@/components/mentor/ChatWorkspace";
import styles from "@/components/mentor/ChatWorkspace.module.css";
import { ChatEmailPreference } from "@/components/mentor/ChatEmailPreference";
import { ChatAvatar, ChatPeople, ChatProfileName, useRememberChatProfiles } from "@/components/mentor/ChatPeople";

function shortDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" }).format(new Date(value)) : "";
}
function statusLabel(status: string) {
  if (status === "pending_mentor") return "Te beantwoorden";
  if (status === "pending_student") return "Beantwoord";
  if (status === "snoozed") return "Later opvolgen";
  if (status === "closed") return "Gesloten";
  return "Open";
}
function inboxUrl(basePath: string, status: string, q: string, threadId?: string | null, cursor?: string | null) {
  const params = new URLSearchParams({ status });
  if (q) params.set("q", q);
  if (threadId) params.set("thread", threadId);
  else params.set("view", "list");
  if (cursor) params.set("cursor", cursor);
  return `${basePath}?${params}`;
}

export function MentorInbox({ rows, detail, currentStudentId, mentorId, status, q, hasMore = false, nextCursor = null, basePath = "/mentor-inbox", totalUnreadCount, chatEmailEnabled = false }: {
  rows: AdminMentorThreadRow[];
  detail: AdminMentorThreadDetail | null;
  currentStudentId: string;
  mentorId: string;
  status: string;
  q: string;
  hasMore?: boolean;
  nextCursor?: string | null;
  basePath?: string;
  totalUnreadCount?: number;
  chatEmailEnabled?: boolean;
}) {
  const router = useRouter();
  const draftsRef = useRef(new Map<string, ChatDraft>());
  const connection = useMentorInboxRealtime(detail?.thread.id ?? null);
  const selectedId = detail?.thread.id ?? null;
  const unreadCount = totalUnreadCount ?? rows.reduce((sum, row) => sum + row.unread_for_mentor_count, 0);

  useEffect(() => {
    if (!selectedId) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("thread") && params.get("view") !== "list") {
      params.set("thread", selectedId);
      router.replace(`${basePath}?${params}`, { scroll: false });
    }
  }, [basePath, router, selectedId]);

  return <ChatPeople profiles={detail?.profiles ?? []}><div className={styles.inbox} data-selected={Boolean(detail)}>
    <aside className={styles.sidebar} aria-label="Studentgesprekken">
      <div className={styles.inboxHeader}>
        <div className={styles.inboxTitle}><h1 className={styles.heading}>Studentvragen</h1>{unreadCount > 0 && <span className={styles.count}>{unreadCount} ongelezen</span>}</div>
        <form action={basePath}>
          {selectedId ? <input type="hidden" name="thread" value={selectedId}/> : <input type="hidden" name="view" value="list"/>}
          <label className={styles.search}><ChatIcon name="search" size={15}/><span className="sr-only">Zoek student of bericht</span><input name="q" defaultValue={q} placeholder="Zoek student of bericht"/></label>
          <div className={styles.filters}>
            <label className="sr-only" htmlFor="inbox-filter">Filter gesprekken</label>
            <select id="inbox-filter" name="status" defaultValue={status} className={styles.select}>
              <option value="active">Alle actieve gesprekken</option><option value="unread">Ongelezen</option><option value="pending_mentor">Te beantwoorden</option><option value="pending_student">Beantwoord</option><option value="open">Open</option><option value="snoozed">Later opvolgen</option><option value="closed">Gesloten</option>
            </select>
            <button type="submit" className={styles.textButton}>Toepassen</button>
          </div>
        </form>
      </div>
      <div className={styles.list}>
        {rows.length === 0 ? <p className={styles.listEmpty}>{q ? "Geen gesprekken gevonden. Probeer een andere zoekterm." : "Geen gesprekken in deze weergave. Nieuwe studentvragen verschijnen hier."}</p> : rows.map((row) => {
          const name = row.student?.name || "Student";
          return <Link key={row.id} href={inboxUrl(basePath, status, q, row.id)} scroll={false} aria-current={row.id === selectedId ? "page" : undefined} className={`${styles.thread} ${row.id === selectedId ? styles.selected : ""}`}>
            <div className={styles.row}><p className={`${styles.threadName} ${row.unread_for_mentor_count > 0 ? styles.unreadName : ""}`}>{name}</p><time className={styles.threadTime} dateTime={row.last_message_at ?? undefined}>{shortDate(row.last_message_at)}</time></div>
            <p className={styles.preview}>{row.lastMessage?.sender_role === "mentor" ? "Jij: " : ""}{row.lastMessage?.body || "Nog geen bericht"}</p>
            <div className={styles.row}><span className={styles.threadState}>{row.priority !== "normal" ? `${row.priority === "urgent" ? "Dringend" : "Hoge prioriteit"} · ` : ""}{statusLabel(row.status)}</span>{row.unread_for_mentor_count > 0 && <span className={styles.unreadCount} aria-label={`${row.unread_for_mentor_count} ongelezen berichten`}>{row.unread_for_mentor_count > 99 ? "99+" : row.unread_for_mentor_count}</span>}</div>
          </Link>;
        })}
        {hasMore && nextCursor && <div className={styles.history}><Link className={styles.textButton} href={inboxUrl(basePath, status, q, selectedId, nextCursor)} scroll={false}>Volgende gesprekken</Link></div>}
      </div>
    </aside>
    <div className={styles.detail}>
      {detail ? <Conversation key={detail.thread.id} detail={detail} currentStudentId={currentStudentId} mentorId={mentorId} connection={connection} chatEmailEnabled={chatEmailEnabled} backUrl={inboxUrl(basePath, status, q)} getDraft={() => {
        const existing = draftsRef.current.get(detail.thread.id);
        if (existing) return existing;
        const draft = newChatDraft();
        draftsRef.current.set(detail.thread.id, draft);
        return draft;
      }} saveDraft={(draft) => { draftsRef.current.set(detail.thread.id, draft); saveChatDraft(currentStudentId, detail.thread.id, draft); }} clearDraft={(sentId) => {
        removeChatDraft(currentStudentId, detail.thread.id, sentId);
        if (draftsRef.current.get(detail.thread.id)?.clientMessageId === sentId) draftsRef.current.delete(detail.thread.id);
      }}/> : <div className={styles.empty}><h2>Selecteer een gesprek</h2><p>Open links een studentvraag om de berichten te lezen en te beantwoorden.</p></div>}
    </div>
  </div></ChatPeople>;
}

function Conversation({ detail, currentStudentId, mentorId, connection, chatEmailEnabled, backUrl, getDraft, saveDraft, clearDraft }: {
  detail: AdminMentorThreadDetail;
  currentStudentId: string;
  mentorId: string;
  connection: ReturnType<typeof useMentorInboxRealtime>;
  chatEmailEnabled: boolean;
  backUrl: string;
  getDraft: () => ChatDraft;
  saveDraft: (draft: ChatDraft) => void;
  clearDraft: (sentId: string) => void;
}) {
  const router = useRouter();
  const threadId = detail.thread.id;
  const rememberProfiles = useRememberChatProfiles();
  const studentName = detail.thread.student?.name || "Student";
  const mentor = detail.profiles.find((person) => person.studentId === detail.thread.assigned_to_student_id);
  const [draft, setDraft] = useState(getDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaPending, setMetaPending] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [older, setOlder] = useState<ConversationMessage[]>([]);
  const [confirmed, setConfirmed] = useState<ConversationMessage[]>([]);
  const [olderAvailable, setOlderAvailable] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const sendLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const saved = restoreChatDraft(currentStudentId, threadId);
    if (saved) { setDraft(saved); saveDraft(saved); }
  // Each keyed conversation restores once; live updates must not replace active input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentId, threadId]);
  const messages = mergeMessages(older, confirmed, detail.messages);
  const acknowledged = acknowledgedChatDraft(draft, currentStudentId, messages);
  useEffect(() => {
    if (!acknowledged) return;
    clearDraft(draft.clientMessageId);
    const next = newChatDraft();
    setDraft(next);
    saveDraft(next);
    setError(null);
  }, [acknowledged, clearDraft, currentStudentId, draft.clientMessageId, saveDraft]);

  function changeDraft(next: ChatDraft) {
    setDraft(next);
    saveDraft(next);
    setError(null);
  }
  async function reply() {
    if (sendLock.current || !draft.body.trim()) return;
    sendLock.current = true;
    setPending(true);
    setError(null);
    const sentDraft = { ...draft };
    const formData = new FormData();
    formData.set("body", sentDraft.body);
    formData.set("client_message_id", sentDraft.clientMessageId);
    formData.set("upload_intent", sentDraft.uploadIntent ?? sentDraft.clientMessageId);
    for (const file of sentDraft.attachments ?? []) formData.append("attachment_ids", file.id);
    if (sentDraft.internal) formData.set("is_internal", "on");
    try {
      const result = await adminReplyToMentorThread(threadId, formData);
      if (!result.success) { if (mounted.current) setError(result.error ?? "Je antwoord kon niet worden verzonden."); return; }
      clearDraft(sentDraft.clientMessageId);
      if (mounted.current) {
        setConfirmed((current) => mergeMessages(current, [result.message]));
        const nextDraft = newChatDraft();
        setDraft(nextDraft);
        saveDraft(nextDraft);
      }
      router.refresh();
    } catch { if (mounted.current) setError("We konden de verzending niet bevestigen."); }
    finally { sendLock.current = false; if (mounted.current) setPending(false); }
  }
  async function loadOlder() {
    const firstSeq = messages.find((message) => message.public_seq !== null)?.public_seq;
    if (!firstSeq || loadingOlder) return;
    setLoadingOlder(true);
    setHistoryError(null);
    try {
      const result = await loadAdminMentorMessages(threadId, firstSeq);
      if (!mounted.current) return;
      if (!result.success) { setHistoryError(result.error); return; }
      rememberProfiles(result.profiles);
      setOlder((current) => mergeMessages(current, result.messages));
      setOlderAvailable(result.hasOlder);
    } catch { if (mounted.current) setHistoryError("Eerdere berichten ophalen mislukt. Probeer opnieuw."); }
    finally { if (mounted.current) setLoadingOlder(false); }
  }
  async function updateMeta(formData: FormData) {
    setMetaPending(true);
    setMetaError(null);
    try {
      const result = await adminUpdateMentorThread(threadId, formData);
      if (!mounted.current) return;
      if (!result.success) { setMetaError(result.error ?? "Opslaan mislukt."); return; }
      router.refresh();
    } catch { if (mounted.current) setMetaError("Opslaan mislukt. Probeer opnieuw."); }
    finally { if (mounted.current) setMetaPending(false); }
  }

  return <>
    <header className={styles.header}>
      <Link href={backUrl} className={styles.mobileBack} aria-label="Terug naar gesprekken" scroll={false}><ChatIcon name="back" size={20}/></Link>
      <ChatAvatar studentId={detail.thread.student_id} name={studentName}/>
      <div className={styles.headerIdentity}><h2 className={styles.heading}><ChatProfileName studentId={detail.thread.student_id}>{studentName}</ChatProfileName></h2><p className={styles.subheading}><ChatIcon name="lock" size={11}/>Privégesprek{mentor ? ` met ${mentor.displayName}` : ""}</p></div>
      <div className={styles.headerEnd}><span>{statusLabel(detail.thread.status)}</span>{chatEmailEnabled && <ChatEmailPreference/>}</div>
    </header>
    <ConnectionNotice status={connection}/>
    <details className={styles.details}>
      <summary>Gesprek beheren<ChatIcon name="down" size={12}/></summary>
      <form action={updateMeta} className={styles.metaForm}>
        <label className={styles.metaLabel}>Status<select name="status" defaultValue={detail.thread.status} className={styles.select}><option value="open">Open</option><option value="pending_mentor">Te beantwoorden</option><option value="pending_student">Beantwoord</option><option value="snoozed">Later opvolgen</option><option value="closed">Gesloten</option></select></label>
        <label className={styles.metaLabel}>Prioriteit<select name="priority" defaultValue={detail.thread.priority} className={styles.select}><option value="normal">Normaal</option><option value="high">Hoog</option><option value="urgent">Dringend</option></select></label>
        <label className={styles.metaLabel}>Categorie<input name="category" defaultValue={detail.thread.category ?? ""} maxLength={80} placeholder="Bijv. strategie"/></label>
        <button type="submit" className={styles.textButton} disabled={metaPending}>{metaPending ? "Opslaan…" : "Opslaan"}</button>
        {metaError && <p className={`${styles.error} ${styles.metaError}`} role="alert">{metaError}</p>}
      </form>
    </details>
    {historyError && <div className={styles.status} role="alert">{historyError}</div>}
    <ChatTranscript messages={messages} currentStudentId={currentStudentId} mentorId={mentorId} hasOlder={olderAvailable ?? detail.hasOlder} loadingOlder={loadingOlder} onOlder={loadOlder} lastReadSeq={detail.lastReadSeq} studentName={studentName} onRead={async (seq) => {
      const result = await adminMarkMentorThreadRead(threadId, seq);
      if (!result.success) throw new Error(result.error);
    }} empty={<div className={styles.empty}><h2>Nog geen berichten</h2><p>Het eerste bericht van deze student verschijnt hier.</p></div>}/>
    <MessageComposer draft={draft} threadId={threadId} onDraftChange={changeDraft} onSubmit={reply} pending={pending} error={error} mentorView studentName={studentName}/>
  </>;
}
