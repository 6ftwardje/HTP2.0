"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationList } from "@/components/notifications/NotificationList";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import { NOTIFICATION_PREVIEW_LIMIT, notificationBadgeLabel, type NotificationItem } from "@/lib/notification-policy";
import styles from "@/components/notifications/Notifications.module.css";

export type FloatingNotification = NotificationItem;

export function NotificationPopover({ notifications, unreadCount, loadError }: {
  notifications: FloatingNotification[]; unreadCount: number; loadError?: string | null;
}) {
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const pathname=usePathname(),router=useRouter();
  useEffect(()=>setOpen(false),[pathname]);
  useEffect(()=>{
    if(!open)return;
    heading.current?.focus();
    function outside(e: PointerEvent){if(!root.current?.contains(e.target as Node))setOpen(false);}
    document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);
  },[open]);
  return <div ref={root} className={styles.popover} onKeyDown={e=>{if(e.key==="Escape"&&open){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}}}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <button ref={trigger} type="button" onClick={()=>setOpen(!open)} aria-label={unreadCount>0?unreadCount+" ongelezen meldingen":"Meldingen openen"}
      aria-haspopup="dialog" aria-expanded={open} className="platform-toolbar-control relative">
      <NavigationIcon name="notifications"/>
      {unreadCount>0&&<span className={styles.badge} aria-hidden="true">{notificationBadgeLabel(unreadCount)}</span>}
    </button>
    {open&&<section role="dialog" aria-label="Meldingen" className={styles.panel}>
      <div className={styles.panelHeader}><h2 ref={heading} tabIndex={-1}>Meldingen</h2><span title="Ongelezen meldingen van de laatste 30 dagen">{unreadCount} ongelezen</span></div>
      <div className={styles.scroll}>
        {loadError?<div className={styles.empty}><p role="alert">{loadError}</p><button type="button" className={styles.bulk} onClick={()=>router.refresh()}>Opnieuw proberen</button></div>
          :<NotificationList notifications={notifications.slice(0,NOTIFICATION_PREVIEW_LIMIT)} compact onNavigate={()=>setOpen(false)}/>}
      </div>
      <div className={styles.footer}><Link href="/notifications" onClick={()=>setOpen(false)}>Bekijk alle meldingen <span className="ml-1" aria-hidden="true">→</span></Link></div>
    </section>}
  </div>;
}
