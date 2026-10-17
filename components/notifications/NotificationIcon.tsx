import { notificationPresentation } from "@/lib/notification-policy";
import styles from "./Notifications.module.css";

export function NotificationIcon({ type }: { type?: string }) {
  const { kind } = notificationPresentation(type);
  return <span className={styles.icon} data-kind={kind} aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {kind==="question"?<><path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8Z"/><path d="M7 8h10M7 12h6"/></>
       :kind==="update"?<><path d="M3 3v18h18M7 15l4-5 4 3 6-8"/></>
       :kind==="module"?<><path d="M12 5C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1ZM12 5v15"/></>
       :kind==="live"?<><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-4v12l-6-4"/></>
       :kind==="technical"?<path d="m14 6 4 4 3-3a6 6 0 0 1-8 7L6 21l-3-3 7-7a6 6 0 0 1 7-8l-3 3Z"/>
       :<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/></>}
    </svg>
  </span>;
}
