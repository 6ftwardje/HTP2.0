"use client";

import { useRef, useState } from "react";
import { setMarketPostReaction } from "@/app/actions/market-post-reactions";

export function UsefulReaction({ postId, initial }: { postId: number; initial: { total: number; active: boolean } | null }) {
  const [state, setState] = useState(initial ?? { total: 0, active: false });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState(initial ? "" : "Reacties zijn tijdelijk niet beschikbaar.");
  async function react() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await setMarketPostReaction(postId, !state.active);
      if (result.error || !result.state) throw new Error(result.error);
      setState(result.state);
    } catch { setError("Je reactie kon niet worden opgeslagen. Probeer opnieuw."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div>
    <button type="button" className="useful-reaction" aria-pressed={state.active} aria-busy={busy} disabled={busy || !initial} onClick={react}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10H3v11h4m0-11 5-7c1.5 0 2 1 2 2.5L13 10h6a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.6 21H7V10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>Nuttig</span><span className="reaction-count">{initial ? state.total : "—"}</span>
    </button>
    <span className="sr-only" role="status">{busy ? "Reactie opslaan" : state.active ? "Je vindt deze update nuttig" : "Je hebt niet gereageerd"}</span>
    {error ? <p role="alert" className="mt-2 text-sm text-[var(--muted)]">{error}</p> : null}
  </div>;
}
