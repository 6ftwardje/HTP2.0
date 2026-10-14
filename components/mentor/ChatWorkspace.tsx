"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { ConversationMessage } from "@/lib/types";
import type { RealtimeConnectionStatus } from "@/lib/realtime-hooks";
import { chatSenderLabel, editChatDraft, hasUnreadHistoryGap, setChatDraftAttachments } from "@/lib/chat-message-state";
import type { ChatDraft } from "@/lib/chat-message-state";
export { mergeChatMessages as mergeMessages, newChatDraft } from "@/lib/chat-message-state";
export type { ChatDraft } from "@/lib/chat-message-state";
import styles from "./ChatWorkspace.module.css";

const timeFormat = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
const dayFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Brussels" });

export function ChatIcon({ name, size = 16 }: { name: "lock" | "send" | "back" | "search" | "down" | "image"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "lock" && <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>}
    {name === "send" && <><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></>}
    {name === "back" && <path d="m14 6-6 6 6 6"/>}
    {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>}
    {name === "down" && <path d="m7 10 5 5 5-5"/>}
    {name === "image" && <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-6-6L3 21"/></>}
  </svg>;
}

export function ConnectionNotice({ status }: { status: RealtimeConnectionStatus }) {
  if (status === "connected" || status === "idle" || status === "connecting") return null;
  return <div className={styles.status} role="status">{status === "offline" ? "Je bent offline. Je bericht blijft hier staan tot je het kunt verzenden." : "Verbinding herstellen. Nieuwe berichten worden opnieuw opgehaald."}</div>;
}

export function ChatTranscript({ messages, hasOlder, loadingOlder, onOlder, lastReadSeq, onRead, currentStudentId, mentorId, studentName = "Student", empty }: {
  messages: ConversationMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  onOlder: () => Promise<void>;
  lastReadSeq: number;
  onRead: (seq: number) => Promise<unknown>;
  currentStudentId: string;
  mentorId: string;
  studentName?: string;
  empty: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef(true);
  const nearBottomRef = useRef(true);
  const previousHeightRef = useRef<number | null>(null);
  const previousGapRef = useRef(false);
  const highestReadRef = useRef(lastReadSeq);
  const onReadRef = useRef(onRead);
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  onReadRef.current = onRead;
  const messageKey = messages.map((message) => message.id).join(":");
  const unreadGap = hasUnreadHistoryGap(messages, lastReadSeq, hasOlder);
  const unreadIndex = messages.findIndex((message) => !message.is_internal && (message.public_seq ?? 0) > lastReadSeq && message.sender_student_id !== currentStudentId);
  const firstUnreadIdRef = useRef<string | null>(null);
  firstUnreadIdRef.current = unreadIndex >= 0 ? messages[unreadIndex].id : null;

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const firstUnread = firstUnreadIdRef.current ? scroll.querySelector<HTMLElement>(`[data-message-id="${firstUnreadIdRef.current}"]`) : null;
    if (initialRef.current || (previousGapRef.current && !unreadGap)) {
      scroll.scrollTop = firstUnread ? firstUnread.offsetTop - scroll.offsetTop - 20 : scroll.scrollHeight;
      initialRef.current = false;
      previousHeightRef.current = null;
    } else if (previousHeightRef.current !== null) {
      scroll.scrollTop += scroll.scrollHeight - previousHeightRef.current;
      previousHeightRef.current = null;
    } else if (nearBottomRef.current) {
      scroll.scrollTop = scroll.scrollHeight;
    } else {
      setShowLatest(true);
    }
    previousGapRef.current = unreadGap;
  }, [messageKey, unreadGap]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || unreadGap) return;
    const visible = new Map<Element, number>();
    function markVisible() {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      const seq = Math.max(highestReadRef.current, ...visible.values());
      if (seq <= highestReadRef.current) return;
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
      readTimerRef.current = setTimeout(() => {
        if (document.visibilityState !== "visible" || !document.hasFocus()) return;
        const currentSeq = Math.max(highestReadRef.current, ...visible.values());
        if (currentSeq <= highestReadRef.current) return;
        highestReadRef.current = currentSeq;
        Promise.resolve(onReadRef.current(currentSeq)).catch(() => {
          highestReadRef.current = lastReadSeq;
        });
      }, 350);
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const readable = entry.isIntersecting && (entry.intersectionRatio >= 0.6 || entry.intersectionRect.height >= Math.min(120, scroll!.clientHeight / 2));
        if (readable) visible.set(entry.target, Number((entry.target as HTMLElement).dataset.seq));
        else visible.delete(entry.target);
      }
      markVisible();
    }, { root: scroll, threshold: 0.6 });
    for (const element of scroll.querySelectorAll("[data-seq]")) observer.observe(element);
    window.addEventListener("focus", markVisible);
    window.addEventListener("online", markVisible);
    document.addEventListener("visibilitychange", markVisible);
    return () => {
      observer.disconnect();
      window.removeEventListener("focus", markVisible);
      window.removeEventListener("online", markVisible);
      document.removeEventListener("visibilitychange", markVisible);
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  }, [messageKey, lastReadSeq, unreadGap]);

  async function loadOlder() {
    const scroll = scrollRef.current;
    if (!scroll || loadingOlder) return;
    previousHeightRef.current = scroll.scrollHeight;
    await onOlder();
    // A failed/empty page must not affect the next incoming message's scroll position.
    requestAnimationFrame(() => { previousHeightRef.current = null; });
  }

  return <div className={styles.transcriptWrap}>
    <div ref={scrollRef} className={styles.transcript} role="log" aria-label="Berichten" aria-live="polite" aria-relevant="additions" onScroll={() => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      nearBottomRef.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
      if (nearBottomRef.current) setShowLatest(false);
    }}>
      {hasOlder && <div className={styles.history}><button type="button" className={styles.textButton} disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? "Berichten ophalen…" : unreadGap ? "Lees eerdere ongelezen berichten" : "Eerdere berichten laden"}</button></div>}
      {messages.length === 0 ? empty : messages.map((message, index) => {
        const own = message.sender_student_id === currentStudentId;
        const day = dayFormat.format(new Date(message.created_at));
        const previousDay = index ? dayFormat.format(new Date(messages[index - 1].created_at)) : null;
        const sender = chatSenderLabel(message, currentStudentId, mentorId, studentName);
        return <Fragment key={message.id}>
          {day !== previousDay && <div className={styles.date}>{day}</div>}
          {index === unreadIndex && lastReadSeq > 0 && <div className={styles.unread}>Nieuwe berichten</div>}
          <article className={`${styles.messageRow} ${own ? styles.ownRow : ""}`} data-message-id={message.id} data-seq={message.is_internal ? undefined : message.public_seq ?? undefined}>
            <div className={`${styles.message} ${own ? styles.ownMessage : ""} ${message.is_internal ? styles.internalMessage : ""}`}>
              <p className={styles.sender}>{sender}</p>
              <p className={styles.body}>{message.body}</p>
              {Boolean(message.attachments?.length) && <div className={styles.attachments}>{message.attachments!.map((file) => <a key={file.id} className={styles.attachment} href={`/api/chat/attachments/${file.id}`} target="_blank" rel="noreferrer" aria-label={`Screenshot openen: ${file.fileName}`}>
                {/* Authenticated images must use the private route, without an optimizer cache. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/chat/attachments/${file.id}`} alt={file.fileName} width={file.width} height={file.height} loading="lazy"/>
                <span>{file.fileName}</span>
              </a>)}</div>}
              <div className={styles.messageMeta}>
                <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" })}>{timeFormat.format(new Date(message.created_at))}</time>
                {own && index === messages.length - 1 && !message.is_internal && <span>· Verzonden</span>}
              </div>
            </div>
          </article>
        </Fragment>;
      })}
      <div ref={endRef}/>
    </div>
    {showLatest && <button type="button" className={styles.latest} onClick={() => {
      endRef.current?.scrollIntoView({ block: "end" });
      nearBottomRef.current = true;
      setShowLatest(false);
    }}>Naar nieuwste berichten</button>}
  </div>;
}

export function MessageComposer({ draft, onDraftChange, onSubmit, pending, error, mentorView = false, disabled = false, studentName = "student", threadId = null }: {
  draft: ChatDraft;
  onDraftChange: (draft: ChatDraft) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
  mentorView?: boolean;
  disabled?: boolean;
  studentName?: string;
  threadId?: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const changeRef = useRef(onDraftChange);
  const uploadRef = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  draftRef.current = draft;
  changeRef.current = onDraftChange;
  useEffect(() => () => { uploadRef.current?.abort(); }, []);
  function changeDraft(next: ChatDraft) { draftRef.current = next; changeRef.current(next); }
  async function upload(files: FileList | null) {
    if (!files?.length || uploading || pending) return;
    const selected = Array.from(files);
    if ((draftRef.current.attachments?.length ?? 0) + selected.length > 3) { setUploadError("Je kunt maximaal drie screenshots toevoegen."); return; }
    if (selected.some((file) => file.size > 4 * 1024 * 1024)) { setUploadError("Gebruik screenshots van maximaal 4 MB per bestand."); return; }
    const controller = new AbortController();
    uploadRef.current = controller;
    setUploading(true);
    setUploadError(null);
    const intent = draftRef.current.uploadIntent ?? draftRef.current.clientMessageId;
    try {
      for (const file of selected) {
        const data = new FormData();
        data.set("file", file);
        data.set("upload_intent", intent);
        if (threadId) data.set("thread_id", threadId);
        const response = await fetch("/api/chat/attachments", { method: "POST", body: data, signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.attachment) throw new Error(result.error || "Screenshot toevoegen is niet gelukt. Probeer opnieuw.");
        if (controller.signal.aborted) return;
        changeDraft(setChatDraftAttachments(draftRef.current, [...(draftRef.current.attachments ?? []), result.attachment]));
      }
    } catch (failure) {
      if (!controller.signal.aborted) setUploadError(failure instanceof Error ? failure.message : "Screenshot toevoegen is niet gelukt. Probeer opnieuw.");
    } finally {
      if (!controller.signal.aborted) { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
      uploadRef.current = null;
    }
  }
  async function removeAttachment(id: string) {
    if (uploading || pending) return;
    setUploadError(null);
    // Removing from a draft never deletes a published screenshot. A previous
    // send may have committed even when its acknowledgement was lost.
    changeDraft(setChatDraftAttachments(draftRef.current, (draftRef.current.attachments ?? []).filter((file) => file.id !== id)));
    try {
      await fetch(`/api/chat/attachments/${id}`, { method: "DELETE" });
    } catch { /* Pending uploads are also reclaimed by the maintenance worker. */ }
  }
  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(164, Math.max(67, textarea.scrollHeight))}px`;
  }, []);
  useLayoutEffect(resize, [draft.body, resize]);
  function submit(event: FormEvent) { event.preventDefault(); if (!pending && !uploading && draft.body.trim() && !disabled) onSubmit(); }
  return <form className={styles.composer} onSubmit={submit} aria-label={mentorView ? `Antwoord aan ${studentName}` : "Bericht aan Rousso"}>
    <div className={`${styles.composerBox} ${draft.internal ? styles.noteBox : ""}`}>
      <label className="sr-only" htmlFor={mentorView ? "mentor-reply" : "mentor-message"}>{draft.internal ? "Interne notitie" : mentorView ? `Je antwoord aan ${studentName}` : "Je bericht aan Rousso"}</label>
      <textarea ref={textareaRef} id={mentorView ? "mentor-reply" : "mentor-message"} className={styles.textarea} value={draft.body} rows={2} maxLength={5000} disabled={pending || disabled} placeholder={draft.internal ? "Schrijf een interne notitie…" : mentorView ? `Antwoord aan ${studentName}…` : "Stel je vraag aan Rousso…"} aria-describedby={error ? "chat-send-error" : undefined} onChange={(event) => onDraftChange(editChatDraft(draft, { body: event.target.value }))} onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
          event.preventDefault();
          if (!pending && !uploading && draft.body.trim() && !disabled) onSubmit();
        }
      }}/>
      {Boolean(draft.attachments?.length) && <ul className={styles.uploads} aria-label="Toegevoegde screenshots">{draft.attachments!.map((file) => <li key={file.id}><span>{file.fileName}</span><button type="button" aria-label={`Verwijder ${file.fileName}`} disabled={pending || uploading} onClick={() => removeAttachment(file.id)}>×</button></li>)}</ul>}
      <div className={styles.composerBar}>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => upload(event.target.files)}/>
        <button type="button" className={styles.uploadButton} aria-label="Screenshot toevoegen" title="PNG, JPEG of WebP · maximaal 4 MB" disabled={pending || uploading || disabled || (draft.attachments?.length ?? 0) >= 3} onClick={() => fileRef.current?.click()}><ChatIcon name="image" size={18}/><span>{uploading ? "Uploaden…" : "Screenshot"}</span></button>
        {mentorView ? <label className={styles.noteToggle}><input type="checkbox" checked={draft.internal} disabled={pending || uploading} onChange={(event) => onDraftChange(editChatDraft(draft, { internal: event.target.checked }))}/>Interne notitie</label> : <span className={styles.hint}>Enter om te verzenden</span>}
        <button type="submit" className={styles.send} disabled={pending || uploading || disabled || !draft.body.trim()}><span>{pending ? "Verzenden…" : draft.internal ? "Notitie opslaan" : "Verzenden"}</span><ChatIcon name="send" size={14}/></button>
      </div>
      {Boolean(draft.attachments?.length) && !draft.body.trim() && <p className={styles.attachmentHint}>Schrijf kort je vraag bij de screenshots.</p>}
    </div>
    {uploadError && <p className={styles.error} role="alert">{uploadError}</p>}
    {error && <p id="chat-send-error" className={styles.error} role="alert">{error} Je bericht is bewaard. Probeer opnieuw.</p>}
  </form>;
}
