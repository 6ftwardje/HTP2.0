"use client";

import { useRef, useState } from "react";
import { getChatEmailPreference, setChatEmailPreference, type ChatEmailPreference as Preference } from "@/app/actions/chat-preferences";
import styles from "./ChatWorkspace.module.css";

export function ChatEmailPreference() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  async function load(enabled?: boolean) {
    if (lock.current) return;
    lock.current = true;
    const previous = preference;
    if (enabled !== undefined && preference) setPreference({ ...preference, enabled });
    setPending(true);
    setError(null);
    try {
      const result = enabled === undefined ? await getChatEmailPreference() : await setChatEmailPreference(enabled);
      if (result.success) setPreference(result.preference);
      else { setPreference(previous); setError(result.error); }
    } catch { setPreference(previous); setError("Je voorkeur kon niet worden opgeslagen. Probeer opnieuw."); }
    finally { lock.current = false; setPending(false); }
  }
  return <details className={styles.emailPreference} onToggle={(event) => { if (event.currentTarget.open && !preference) void load(); }}>
    <summary aria-label="E-mailmeldingen instellen" title="E-mailmeldingen">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
    </summary>
    <div className={styles.preferencePanel}>
      <label><input type="checkbox" checked={Boolean(preference?.enabled && !preference.suppressed)} disabled={pending || !preference || preference.suppressed} onChange={(event) => void load(event.target.checked)}/>E-mail bij nieuwe berichten</label>
      <p>{preference?.suppressed ? "Je hebt e-mailmeldingen afgemeld." : "Een korte melding als je een nieuw bericht nog niet hebt gelezen. Zonder de inhoud van je gesprek."}</p>
      {pending && <span role="status">Voorkeur laden…</span>}
      {error && <><p className={styles.error} role="alert">{error}</p><button type="button" className={styles.textButton} onClick={() => void load()}>Opnieuw proberen</button></>}
    </div>
  </details>;
}
