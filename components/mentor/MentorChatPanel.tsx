"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadMentorMessages, markMentorThreadRead, sendMentorMessage } from "@/app/actions/mentor-chat";
import { useConversationRealtime } from "@/lib/realtime-hooks";
import type { ConversationMessage, ConversationThread } from "@/lib/types";
import { acknowledgedChatDraft, removeChatDraft, restoreChatDraft, saveChatDraft } from "@/lib/chat-message-state";
import { ChatIcon, ChatTranscript, ConnectionNotice, mergeMessages, MessageComposer, newChatDraft } from "./ChatWorkspace";
import styles from "./ChatWorkspace.module.css";
import { ChatEmailPreference } from "./ChatEmailPreference";

export function MentorChatPanel({ thread, messages, currentStudentId, mentorId, hasOlder = false, lastReadSeq = 0, mentorName = "Rousso", chatEmailEnabled = false }: {
  thread: ConversationThread | null;
  messages: ConversationMessage[];
  currentStudentId: string;
  mentorId: string;
  hasOlder?: boolean;
  lastReadSeq?: number;
  mentorName?: string;
  chatEmailEnabled?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(newChatDraft);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<ConversationMessage[]>([]);
  const [older, setOlder] = useState<ConversationMessage[]>([]);
  const [olderAvailable, setOlderAvailable] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);
  const sendLock = useRef(false);
  const activeThreadId = thread?.id ?? createdThreadId;
  const connection = useConversationRealtime(activeThreadId);
  const visibleMessages = mergeMessages(older, confirmed, messages);
  const acknowledged = acknowledgedChatDraft(draft, currentStudentId, visibleMessages);
  useEffect(() => {
    if (!acknowledged) return;
    removeChatDraft(currentStudentId, activeThreadId, draft.clientMessageId);
    setDraft(newChatDraft());
    setError(null);
  }, [acknowledged, activeThreadId, currentStudentId, draft.clientMessageId]);
  useEffect(() => {
    const saved = restoreChatDraft(currentStudentId, activeThreadId);
    setDraft(saved ?? newChatDraft());
  }, [currentStudentId, activeThreadId]);

  async function submit() {
    if (sendLock.current || !draft.body.trim()) return;
    sendLock.current = true;
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("body", draft.body);
    formData.set("client_message_id", draft.clientMessageId);
    formData.set("upload_intent", draft.uploadIntent ?? draft.clientMessageId);
    for (const file of draft.attachments ?? []) formData.append("attachment_ids", file.id);
    try {
      const result = await sendMentorMessage(formData);
      if (!result.success) { setError(result.error ?? "Je bericht kon niet worden verzonden."); return; }
      setConfirmed((current) => mergeMessages(current, [result.message]));
      removeChatDraft(currentStudentId, activeThreadId, draft.clientMessageId);
      setCreatedThreadId(result.threadId);
      setDraft(newChatDraft());
      router.refresh();
    } catch {
      setError("We konden de verzending niet bevestigen.");
    } finally {
      sendLock.current = false;
      setPending(false);
    }
  }

  async function loadOlder() {
    if (!activeThreadId || loadingOlder) return;
    const firstSeq = visibleMessages.find((message) => message.public_seq !== null)?.public_seq;
    if (!firstSeq) return;
    setLoadingOlder(true);
    setHistoryError(null);
    try {
      const result = await loadMentorMessages(activeThreadId, firstSeq);
      if (!result.success) { setHistoryError(result.error); return; }
      setOlder((current) => mergeMessages(current, result.messages));
      setOlderAvailable(result.hasOlder);
    } catch { setHistoryError("Eerdere berichten ophalen mislukt. Probeer opnieuw."); }
    finally { setLoadingOlder(false); }
  }

  return <section className={styles.workspace} aria-label={`Privégesprek met ${mentorName}`}>
    <header className={styles.header}>
      <div className={styles.avatar} aria-hidden="true">R</div>
      <div><h1 className={styles.heading}>{mentorName}</h1><p className={styles.subheading}><ChatIcon name="lock" size={11}/>Privégesprek</p></div>
      {chatEmailEnabled && <div className={styles.headerEnd}><ChatEmailPreference/></div>}
    </header>
    <ConnectionNotice status={connection}/>
    {historyError && <div className={styles.status} role="alert">{historyError}</div>}
    <ChatTranscript messages={visibleMessages} currentStudentId={currentStudentId} mentorId={mentorId} hasOlder={olderAvailable ?? hasOlder} loadingOlder={loadingOlder} onOlder={loadOlder} lastReadSeq={lastReadSeq} onRead={async (seq) => {
      if (!activeThreadId) return;
      const result = await markMentorThreadRead(activeThreadId, seq);
      if (!result.success) throw new Error(result.error);
    }} empty={<div className={styles.empty}><h2>Waar kan ik je mee helpen?</h2><p>Stel je vraag over een les, je analyse of je volgende stap. Je bericht komt rechtstreeks bij Rousso terecht.</p></div>}/>
    <MessageComposer draft={draft} threadId={activeThreadId} onDraftChange={(next) => { setDraft(next); saveChatDraft(currentStudentId, activeThreadId, next); setError(null); }} onSubmit={submit} pending={pending} error={error}/>
  </section>;
}
