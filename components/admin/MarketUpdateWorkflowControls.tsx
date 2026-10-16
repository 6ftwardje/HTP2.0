"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminArchiveMarketUpdate,
  adminDuplicateMarketUpdate,
  adminUpdateMarketUpdateWorkflow,
} from "@/app/actions/admin/market-update-workflow";
import {
  CLOSE_REASON_OPTIONS,
  SETUP_STATUS_OPTIONS,
  TEMPLATE_FIELDS,
  closeReasonLabel,
  getUpdateStructure,
  isOpenSetup,
  setupStatusLabel,
  type SetupCloseReason,
  type SetupStatus,
} from "@/lib/market-update-structure";
import type { AdminWeeklyUpdateRow } from "@/lib/admin/weekly-updates";

const inputClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function historyDate(value: string) {
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }).format(new Date(value));
}

export function MarketUpdateWorkflowControls({ update, hasUnsavedChanges }: { update: AdminWeeklyUpdateRow; hasUnsavedChanges?: () => boolean }) {
  const router = useRouter();
  const structure = getUpdateStructure(update);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [closeReason, setCloseReason] = useState<SetupCloseReason>(structure?.close_reason ?? (structure?.setup_status === "waiting" ? "cancelled" : "manual"));
  const [correctStatus, setCorrectStatus] = useState<SetupStatus>(structure?.setup_status ?? "waiting");
  const [correctionTarget, setCorrectionTarget] = useState("");
  const [targetReached, setTargetReached] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [createdDraftId, setCreatedDraftId] = useState<number | null>(null);
  const archived = update.actuality_status === "archive";
  const openSetup = isOpenSetup(update);

  function run(task: () => Promise<{ success: boolean; error?: string; weeklyUpdateId?: number }>, successText: string) {
    setFeedback(null);
    if (hasUnsavedChanges?.()) { setFeedback({ error: true, text: "Sla de formulierwijzigingen eerst op. Daarna kun je de opvolging of het archief bijwerken." }); return; }
    startTransition(async () => {
      try {
        const result = await task();
        if (result.weeklyUpdateId) setCreatedDraftId(result.weeklyUpdateId);
        if (!result.success && result.weeklyUpdateId) router.refresh();
        if (!result.success) { setFeedback({ error: true, text: result.error ?? "De wijziging kon niet worden opgeslagen." }); return; }
        setNote("");
        setFeedback({ error: false, text: successText });
        router.refresh();
      } catch {
        setFeedback({ error: true, text: "Opslaan mislukt. Vernieuw de pagina en probeer opnieuw." });
      }
    });
  }

  function workflow(action: "entry" | "target" | "close" | "follow_up" | "correct", extra: { targetIndex?: number; reason?: SetupCloseReason; status?: SetupStatus; targetReached?: boolean } = {}) {
    run(() => adminUpdateMarketUpdateWorkflow(update.id, { action, expectedUpdatedAt: update.updated_at, note: note.trim() || undefined, ...extra }), "Opvolging opgeslagen.");
  }

  return <section className="mt-6 space-y-4 border-t border-[var(--border)] pt-5" aria-labelledby={`workflow-heading-${update.id}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 id={`workflow-heading-${update.id}`} className="text-base font-semibold">Opvolging en beheer</h3>{structure?.type === "setup" ? <span className="cb-badge cb-badge-available">{setupStatusLabel(structure.setup_status)}{structure.close_reason ? ` · ${closeReasonLabel(structure.close_reason)}` : ""}</span> : null}</div>
    {structure && update.is_published && !archived ? <>
      <label className="block space-y-1.5"><span className="text-sm font-semibold">Opvolgingsnotitie</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Wat is veranderd en wat betekent dit voor het scenario?" className={inputClass} /><span className="block text-xs leading-5 text-[var(--muted)]">Deze notitie is zichtbaar voor leden. Een belangrijke opvolging zet de update opnieuw bovenaan.</span></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !note.trim()} onClick={() => workflow("follow_up")} className="cb-btn cb-btn-secondary min-h-11 text-xs">Opvolging toevoegen</button>
        {structure.type === "setup" && structure.setup_status === "waiting" ? <button type="button" disabled={pending} onClick={() => workflow("entry")} className="cb-btn cb-btn-primary min-h-11 text-xs">Entry bereikt</button> : null}
        {structure.type === "setup" && structure.setup_status === "running" ? structure.targets.map((target, index) => <button key={index} type="button" disabled={pending || Boolean(target.reached_at)} onClick={() => workflow("target", { targetIndex: index })} className="cb-btn cb-btn-secondary min-h-11 text-xs">{target.reached_at ? `Doel ${index + 1} bereikt` : `Doel ${index + 1} bereikt markeren`}</button>) : null}
      </div>
      {openSetup ? <details className="border-t border-[var(--border)] pt-3"><summary className="cursor-pointer py-1 text-sm font-semibold">Setup afsluiten</summary><div className="mt-3 space-y-3"><label className="block space-y-1.5"><span className="text-sm font-semibold">Afsluitreden</span><select value={closeReason} onChange={(event) => setCloseReason(event.target.value as SetupCloseReason)} className={inputClass}>{CLOSE_REASON_OPTIONS.filter((option) => structure.setup_status === "waiting" ? ["cancelled", "expired"].includes(option.value) : ["targets", "stopped", "manual"].includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><p className="text-xs leading-5 text-[var(--muted)]">Licht de afsluiting kort toe in de opvolgingsnotitie hierboven. Een toelichting is bij elke afsluitreden verplicht.</p><button type="button" disabled={pending || !note.trim()} onClick={() => workflow("close", { reason: closeReason })} className="cb-btn cb-btn-secondary min-h-11 text-xs">Setup afsluiten</button></div></details> : null}
      {structure.type === "setup" ? <details className="border-t border-[var(--border)] pt-3"><summary className="cursor-pointer py-1 text-sm font-semibold">Foutieve status corrigeren</summary><div className="mt-3 space-y-3"><p className="text-xs leading-5 text-[var(--muted)]">Een correctie blijft zichtbaar in de geschiedenis. Vul hierboven een uitleg in.</p><label className="block space-y-1.5"><span className="text-sm font-semibold">Juiste status</span><select value={correctStatus} onChange={(event) => setCorrectStatus(event.target.value as SetupStatus)} className={inputClass}>{SETUP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{correctStatus === "closed" ? <label className="block space-y-1.5"><span className="text-sm font-semibold">Juiste afsluitreden</span><select value={closeReason} onChange={(event) => setCloseReason(event.target.value as SetupCloseReason)} className={inputClass}>{CLOSE_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}<label className="block space-y-1.5"><span className="text-sm font-semibold">Doel corrigeren <span className="font-normal text-[var(--muted)]">· optioneel</span></span><select value={correctionTarget} onChange={(event) => { setCorrectionTarget(event.target.value); const target = structure.targets[Number(event.target.value)]; setTargetReached(Boolean(target?.reached_at)); }} className={inputClass}><option value="">Geen doel wijzigen</option>{structure.targets.map((target, index) => <option key={index} value={index}>Doel {index + 1} · {target.label}</option>)}</select></label>{correctionTarget !== "" ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={targetReached} onChange={(event) => setTargetReached(event.target.checked)} />Dit doel is bereikt</label> : null}<button type="button" disabled={pending || !note.trim()} onClick={() => workflow("correct", { status: correctStatus, reason: correctStatus === "closed" ? closeReason : undefined, ...(correctionTarget !== "" ? { targetIndex: Number(correctionTarget), targetReached } : {}) })} className="cb-btn cb-btn-secondary min-h-11 text-xs">Correctie vastleggen</button></div></details> : null}
    </> : null}
    {structure?.history.length ? <details className="border-t border-[var(--border)] pt-3"><summary className="cursor-pointer py-1 text-sm font-semibold">Geschiedenis ({structure.history.length})</summary><ol className="mt-3 space-y-4">{[...structure.history].reverse().map((event) => <li key={event.id} className="space-y-1 text-sm"><p className="text-xs text-[var(--muted)]"><time dateTime={event.at}>{historyDate(event.at)}</time> · {event.author}</p><p className="whitespace-pre-line break-words leading-6">{event.note}</p>{event.snapshot ? <details><summary className="cursor-pointer text-xs font-semibold text-[var(--muted)]">Eerdere waarden bekijken</summary><dl className="mt-2 space-y-2 border-t border-[var(--border)] pt-2 text-xs">{TEMPLATE_FIELDS[structure.type].filter((field) => event.snapshot!.fields[field.key]).map((field) => <div key={field.key}><dt className="font-semibold">{field.label}</dt><dd className="whitespace-pre-line break-words text-[var(--muted)]">{event.snapshot!.fields[field.key]}</dd></div>)}{event.snapshot.setup_status ? <div><dt className="font-semibold">Status</dt><dd className="text-[var(--muted)]">{setupStatusLabel(event.snapshot.setup_status)}{event.snapshot.close_reason ? ` · ${closeReasonLabel(event.snapshot.close_reason)}` : ""}</dd></div> : null}{event.snapshot.targets.map((target, index) => <div key={index}><dt className="font-semibold">Doel {index + 1} · {target.reached_at ? "Bereikt" : "Open"}</dt><dd className="break-words text-[var(--muted)]">{target.label}</dd></div>)}</dl></details> : null}</li>)}</ol></details> : null}
    <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
      {update.type === "market_update" ? <button type="button" disabled={pending} onClick={() => run(() => adminDuplicateMarketUpdate(update.id), "Nieuw concept aangemaakt. Je vindt het bij Concepten.")} className="cb-btn cb-btn-secondary min-h-11 text-xs">Dupliceren als concept</button> : null}
      <button type="button" disabled={pending || !update.is_published || (!archived && openSetup)} onClick={() => run(() => adminArchiveMarketUpdate(update.id, !archived, update.updated_at), archived ? "Update teruggezet naar het actuele overzicht." : "Update gearchiveerd.")} className="cb-btn cb-btn-secondary min-h-11 text-xs">{archived ? "Terugzetten uit archief" : "Archiveren"}</button>
    </div>
    {!archived && openSetup ? <p className="text-xs leading-5 text-[var(--muted)]">Sluit de setup af voordat je deze archiveert.</p> : null}
    {pending ? <p role="status" className="text-sm text-[var(--muted)]">Wijziging opslaan…</p> : null}
    {feedback ? <p role={feedback.error ? "alert" : "status"} className={`text-sm ${feedback.error ? "text-red-700 dark:text-red-300" : "text-[var(--muted)]"}`}>{feedback.text}</p> : null}
    {createdDraftId ? <Link href={`/admin/market-analysis?update=${createdDraftId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline underline-offset-4">Nieuw concept openen →</Link> : null}
  </section>;
}
