"use client";

import { useEffect, useRef, useState } from "react";
import { loadMentorMessages, markMentorThreadRead, sendMentorMessage } from "@/app/actions/mentor-chat";
import { useConversationRealtime } from "@/lib/realtime-hooks";
import type { ConversationMessage, ConversationThread } from "@/lib/types";
import { acknowledgedChatDraft, removeChatDraft, restoreChatDraft, saveChatDraft } from "@/lib/chat-message-state";
import { ChatIcon, ChatTranscript, ConnectionNotice, mergeMessages, MessageComposer, newChatDraft } from "./ChatWorkspace";
import styles from "./ChatWorkspace.module.css";
import { ChatEmailPreference } from "./ChatEmailPreference";
import { ChatAvatar, ChatProfileName, useRememberChatProfiles } from "./ChatPeople";

export function MentorChatPanel({ thread, messages, currentStudentId, mentorId, hasOlder = false, lastReadSeq = 0, mentorName = "je mentor", chatEmailEnabled = false }: {
  thread: ConversationThread | null;
  messages: ConversationMessage[];
  currentStudentId: string;
  mentorId: string;
  hasOlder?: boolean;
  lastReadSeq?: number;
  mentorName?: string;
  chatEmailEnabled?: boolean;
}) {
  const rememberProfiles = useRememberChatProfiles();
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
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const activeThreadId = thread?.id ?? createdThreadId;
  // Before the first message, scope saved drafts to the selected mentor too.
  const draftScope = `mentor:${mentorId}`;
  const restoredScope = useRef<string | null>(null);
  const connection = useConversationRealtime(activeThreadId);
  const visibleMessages = mergeMessages(older, confirmed, messages);
  const acknowledged = acknowledgedChatDraft(draft, currentStudentId, visibleMessages);
  useEffect(() => {
    if (!acknowledged) return;
    removeChatDraft(currentStudentId, draftScope, draft.clientMessageId);
    setDraft(newChatDraft());
    setError(null);
  }, [acknowledged, draftScope, currentStudentId, draft.clientMessageId]);
  useEffect(() => {
    if (restoredScope.current === draftScope) return;
    restoredScope.current = draftScope;
    const saved = restoreChatDraft(currentStudentId, draftScope) ?? (thread?.id ? restoreChatDraft(currentStudentId, thread.id) : null);
    if (saved) {
      setDraft(saved);
      saveChatDraft(currentStudentId, draftScope, saved);
      if (thread?.id) removeChatDraft(currentStudentId, thread.id, saved.clientMessageId);
    }
  }, [currentStudentId, draftScope, thread?.id]);

  async function submit() {
    if (sendLock.current || !draft.body.trim()) return;
    sendLock.current = true;
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("body", draft.body);
    formData.set("mentor_id", mentorId);
    formData.set("client_message_id", draft.clientMessageId);
    formData.set("upload_intent", draft.uploadIntent ?? draft.clientMessageId);
    for (const file of draft.attachments ?? []) formData.append("attachment_ids", file.id);
    try {
      const result = await sendMentorMessage(formData);
      if (!result.success) { if (mounted.current) setError(result.error ?? "Je bericht kon niet worden verzonden."); return; }
      removeChatDraft(currentStudentId, draftScope, draft.clientMessageId);
      if (mounted.current) {
        setConfirmed((current) => mergeMessages(current, [result.message]));
        setCreatedThreadId(result.threadId);
        setDraft(newChatDraft());
      }
      // The server action revalidates chat data; the active subscription catches
      // up as well. A second refresh here could race a mentor navigation.
    } catch {
      if (mounted.current) setError("We konden de verzending niet bevestigen.");
    } finally {
      sendLock.current = false;
      if (mounted.current) setPending(false);
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
      if (!mounted.current) return;
      if (!result.success) { setHistoryError(result.error); return; }
      rememberProfiles(result.profiles);
      setOlder((current) => mergeMessages(current, result.messages));
      setOlderAvailable(result.hasOlder);
    } catch { if (mounted.current) setHistoryError("Eerdere berichten ophalen mislukt. Probeer opnieuw."); }
    finally { if (mounted.current) setLoadingOlder(false); }
  }

  return <section className={styles.workspace} aria-label={`Privégesprek met ${mentorName}`}>
    <header className={styles.header}>
      <ChatAvatar studentId={mentorId} name={mentorName}/>
      <div className={styles.headerIdentity}><h1 className={styles.heading}><ChatProfileName studentId={mentorId}>{mentorName}</ChatProfileName></h1><p className={styles.subheading}><ChatIcon name="lock" size={11}/>Privégesprek</p></div>
      {chatEmailEnabled && <div className={styles.headerEnd}><ChatEmailPreference/></div>}
    </header>
    <ConnectionNotice status={connection}/>
    {historyError && <div className={styles.status} role="alert">{historyError}</div>}
    <ChatTranscript messages={visibleMessages} currentStudentId={currentStudentId} mentorId={mentorId} hasOlder={olderAvailable ?? hasOlder} loadingOlder={loadingOlder} onOlder={loadOlder} lastReadSeq={lastReadSeq} onRead={async (seq) => {
      if (!activeThreadId) return;
      const result = await markMentorThreadRead(activeThreadId, seq);
      if (!result.success) throw new Error(result.error);
    }} empty={<div className={styles.empty}><h2>Waar kan ik je mee helpen?</h2><p>Stel je vraag over een les, je analyse of je volgende stap. Je bericht komt rechtstreeks bij {mentorName} terecht.</p></div>}/>
    <MessageComposer draft={draft} threadId={activeThreadId} mentorName={mentorName} onDraftChange={(next) => { setDraft(next); saveChatDraft(currentStudentId, draftScope, next); setError(null); }} onSubmit={submit} pending={pending} error={error}/>
  </section>;
}
