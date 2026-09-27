"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminAttachChartImage, adminCreateChartUpload, adminCreateQuickMarketUpdate, adminPublishQuickMarketUpdate } from "@/app/actions/admin/weekly-updates";
import { createClient } from "@/lib/supabase/client";
import { MARKET_OPTIONS } from "@/lib/market-analysis";

export function QuickMarketUpdateComposer() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (expanded) {
      openedRef.current = true;
      textareaRef.current?.focus();
    } else if (openedRef.current) {
      triggerRef.current?.focus();
    }
  }, [expanded]);

  function submit(formData: FormData, publish: boolean) {
    setError(null);
    setNotice(null);
    if (files.length > 4) { setError("Voeg maximaal vier charts toe."); return; }
    formData.set("chart_count", String(files.length));
    startTransition(async () => {
      setStep("Concept opslaan…");
      try {
        const created = await adminCreateQuickMarketUpdate(formData);
        if (!created.success || !created.weeklyUpdateId) { setError(created.error ?? "Opslaan mislukt."); return; }
        const id = created.weeklyUpdateId;
        for (const file of files) {
          setStep(`Chart uploaden: ${file.name}`);
          const signed = await adminCreateChartUpload(id, { type: file.type, size: file.size });
          if (!signed.success || !signed.path || !signed.token) { setError(`${signed.error ?? "Chartupload mislukt."} Het concept staat veilig in Marktinzicht.`); return; }
          const { error: uploadError } = await createClient().storage.from("market-update-charts").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
          if (uploadError) { setError(`${uploadError.message} Het concept staat veilig in Marktinzicht.`); return; }
          const attached = await adminAttachChartImage(id, signed.path);
          if (!attached.success) { setError(`${attached.error ?? "Chart koppelen mislukt."} Het concept staat veilig in Marktinzicht.`); return; }
        }
        if (publish) {
          setStep("Publiceren…");
          const result = await adminPublishQuickMarketUpdate(id);
          if (!result.success) { setError(`${result.error ?? "Publiceren mislukt."} Het concept staat veilig in Marktinzicht.`); return; }
        }
        formRef.current?.reset();
        setFiles([]);
        setExpanded(false);
        setNotice(publish ? "Update gepubliceerd voor studenten." : "Concept opgeslagen in Marktinzicht.");
        router.refresh();
      } catch {
        setError("Er ging iets mis. Controleer je concept in Marktinzicht voordat je opnieuw plaatst.");
      } finally {
        setStep(null);
      }
    });
  }

  return <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6" aria-labelledby="quick-update-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="quick-update-title" className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Deel een marktupdate</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Een kort bericht of chart voor je studenten.</p>
      </div>
      <Link href="/admin/market-analysis" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline">Alle updates beheren →</Link>
    </div>

    <button
      ref={triggerRef}
      type="button"
      aria-expanded={expanded}
      aria-controls="quick-update-form"
      onClick={() => setExpanded((value) => !value)}
      className={`mt-5 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-left text-sm transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${expanded ? "hidden" : ""}`}
    >
      <span className="text-[var(--muted)]">Wat wil je met studenten delen?</span>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--accent)]">
        <path d="m4 20 4.2-.9L19 8.3 15.7 5 4.9 15.8 4 20ZM14.3 6.4l3.3 3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>

    <form id="quick-update-form" ref={formRef} action={(data) => submit(data, false)} className={expanded ? "mt-5 space-y-4" : "hidden"}>
      <label className="block">
        <span className="sr-only">Je marktupdate</span>
        <textarea
          ref={textareaRef}
          name="body"
          required
          minLength={20}
          maxLength={12000}
          rows={5}
          placeholder="Wat speelt er op de markt? Deel je observatie met studenten…"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-6 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kies markten">
        {[...MARKET_OPTIONS, { value: "macro", label: "Macro" }].map((market) => <label key={market.value} className="flex min-h-10 cursor-pointer items-center rounded-full border border-[var(--border)] px-3 text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)] has-[:checked]:border-[var(--foreground)] has-[:checked]:bg-[var(--foreground)] has-[:checked]:text-[var(--background)]"><input type="checkbox" name="markets" value={market.value} className="sr-only" />{market.label}</label>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface-hover)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
          Chart toevoegen
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { const next = Array.from(event.target.files ?? []); setFiles(next); setError(next.length > 4 ? "Voeg maximaal vier charts toe." : null); }} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => setExpanded(false)} className="cb-btn cb-btn-secondary min-h-11 text-sm">Sluiten</button>
          <button type="submit" disabled={pending} className="cb-btn cb-btn-secondary min-h-11 text-sm">Concept bewaren</button>
          <button type="button" disabled={pending} className="cb-btn cb-btn-primary min-h-11 text-sm" onClick={() => { if (formRef.current?.reportValidity()) submit(new FormData(formRef.current), true); }}>Publiceren</button>
        </div>
      </div>
      {files.length ? <p className="text-xs text-[var(--muted)]">{files.length} chart{files.length === 1 ? "" : "s"} geselecteerd · JPG, PNG of WebP · max. 10 MB per bestand</p> : null}
      <p className="text-xs text-[var(--muted)]">Publiceren maakt de update zichtbaar voor studenten met toegang en kan meldingen versturen. Bewaar als concept om eerst te controleren.</p>
    </form>
    {step ? <p role="status" className="mt-3 text-sm">{step}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">{notice}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
  </section>;
}
