"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { readNotification, removeNotification, readAllNotifications } from "@/app/actions/notifications";
import { notificationHref, notificationPresentation, type NotificationItem } from "@/lib/notification-policy";
import { RelativeDate } from "@/components/ui/RelativeDate";
import { NotificationIcon } from "./NotificationIcon";
import styles from "./Notifications.module.css";

export function NotificationEmpty() {
  return <div className={styles.empty}><NotificationIcon type="system"/><strong>Je bent helemaal mee.</strong>Nieuwe berichten verschijnen hier zodra ze gedeeld worden.</div>;
}

export function NotificationList({ notifications, compact = false, onNavigate }: {
  notifications: NotificationItem[]; compact?: boolean; onNavigate?: () => void;
}) {
  const router=useRouter();
  const [pendingId,setPendingId]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const [hidden,setHidden]=useState<string[]>([]),[read,setRead]=useState<string[]>([]);
  const items=Array.from(new Map(notifications.filter(n=>!hidden.includes(n.id)).map(n=>[n.id,n])).values());
  async function open(e: MouseEvent<HTMLAnchorElement|HTMLButtonElement>, n: NotificationItem) {
    const href=notificationHref(n.href),modified=e.metaKey||e.ctrlKey||e.shiftKey||e.altKey;
    if (!modified || !href) e.preventDefault();
    if (pendingId===n.id) { e.preventDefault(); return; }
    setError(null);setNotice(null);setPendingId(n.id);
    try {
      const result=await readNotification(n.id);
      if(!result.success){setError(result.error);return;}
      setRead(ids=>[...new Set([...ids,n.id])]);
      if(href){onNavigate?.();if(!modified)router.push(href);}
      else setNotice("Deze melding heeft geen gekoppelde inhoud. Ze is als gelezen gemarkeerd.");
      router.refresh();
    } catch { setError("Melding openen is niet gelukt. Probeer opnieuw."); }
    finally { setPendingId(null); }
  }
  async function remove(e: MouseEvent<HTMLButtonElement>, n: NotificationItem) {
    e.preventDefault();e.stopPropagation();setError(null);setNotice(null);setPendingId(n.id);
    try {
      const result=await removeNotification(n.id);
      if(!result.success){setError(result.error);return;}
      setHidden(ids=>[...ids,n.id]);router.refresh();
    } catch {setError("Verwijderen is niet gelukt. Probeer opnieuw.");}
    finally {setPendingId(null);}
  }
  return <div className={styles.root+(compact?" "+styles.compact:"")}>
    {error&&<p role="alert" className={styles.message}>{error}</p>}
    {notice&&<p role="status" className={styles.message}>{notice}</p>}
    {!items.length?<NotificationEmpty/>:<ul className={styles.list}>{items.map(n=>{
      const href=notificationHref(n.href),isRead=n.read||read.includes(n.id),type=notificationPresentation(n.type);
      const content=<><NotificationIcon type={n.type}/><span className={styles.copy}>
        <span className={styles.titleLine}><span className={styles.title}>{n.title}</span>{!isRead&&<span className={styles.dot} aria-label="Ongelezen"/>}</span>
        {n.description&&<span className={styles.body}>{n.description}</span>}
        <span className={styles.meta}>{!compact&&<span>{type.label}</span>}<RelativeDate value={n.timestamp} focusable={false}/></span>
      </span></>;
      return <li key={n.id} data-notification-id={n.id} className={styles.item} data-read={isRead} aria-busy={pendingId===n.id}>
        {href?<Link href={href} prefetch={false} className={styles.open} aria-disabled={pendingId===n.id} onClick={e=>void open(e,n)}>{content}</Link>
          :<button type="button" className={styles.open} disabled={pendingId===n.id} onClick={e=>void open(e,n)}>{content}</button>}
        <button type="button" onClick={e=>void remove(e,n)} disabled={pendingId!==null} className={styles.remove} aria-label={"Melding verwijderen: "+n.title}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
      </li>;
    })}</ul>}
  </div>;
}

export function MarkAllNotificationsRead({ unreadTotal }: { unreadTotal: number }) {
  const router=useRouter(),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
  async function markAll() {
    setError(null);setPending(true);
    try { const result=await readAllNotifications();if(!result.success)setError(result.error);else router.refresh(); }
    catch {setError("Meldingen bijwerken is niet gelukt. Probeer opnieuw.");}
    finally {setPending(false);}
  }
  return <div>{error&&<p role="alert" className={styles.message}>{error}</p>}<button type="button" onClick={()=>void markAll()} disabled={pending||unreadTotal===0} className={styles.bulk}>{pending?"Meldingen bijwerken…":"Alles als gelezen markeren"}</button></div>;
}
