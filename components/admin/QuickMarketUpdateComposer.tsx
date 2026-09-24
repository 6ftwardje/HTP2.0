"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminAttachChartImage, adminCreateChartUpload, adminCreateQuickMarketUpdate, adminPublishQuickMarketUpdate } from "@/app/actions/admin/weekly-updates";
import { createClient } from "@/lib/supabase/client";
import { MARKET_OPTIONS } from "@/lib/market-analysis";

export function QuickMarketUpdateComposer() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

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
        setNotice(publish ? "Update gepubliceerd voor studenten." : "Concept opgeslagen in Marktinzicht.");
        router.refresh();
      } catch {
        setError("Er ging iets mis. Controleer je concept in Marktinzicht voordat je opnieuw plaatst.");
      } finally {
        setStep(null);
      }
    });
  }

  return <section className="cb-panel p-5 sm:p-6" aria-labelledby="quick-update-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="cb-eyebrow">Mentor · Marktupdate</div><h2 id="quick-update-title" className="cb-h2 mt-2">Deel een snelle update</h2><p className="cb-body mt-1">Een bericht of chart, zonder videoformulier.</p></div>
      <Link href="/admin/market-analysis" className="text-sm font-semibold underline underline-offset-4">Alle updates beheren →</Link>
    </div>
    <form ref={formRef} action={(data) => submit(data, false)} className="mt-5 space-y-4">
      <label className="block"><span className="sr-only">Je marktupdate</span><textarea name="body" required minLength={20} maxLength={12000} rows={5} placeholder="Wat speelt er op de markt? Deel je observatie met studenten…" className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--foreground)]" /></label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kies markten">
        {[...MARKET_OPTIONS, { value: "macro", label: "Macro" }].map((market) => <label key={market.value} className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1.5 text-sm has-[:checked]:border-[var(--foreground)] has-[:checked]:bg-[var(--foreground)] has-[:checked]:text-[var(--background)]"><input type="checkbox" name="markets" value={market.value} className="sr-only" />{market.label}</label>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <label className="cursor-pointer text-sm font-semibold"><span className="rounded-lg border border-[var(--border)] px-3 py-2">＋ Chart toevoegen</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { const next = Array.from(event.target.files ?? []); setFiles(next); setError(next.length > 4 ? "Voeg maximaal vier charts toe." : null); }} /></label>
        <div className="flex gap-2"><button type="submit" disabled={pending} className="cb-btn cb-btn-secondary text-sm">Concept bewaren</button><button type="button" disabled={pending} className="cb-btn cb-btn-primary text-sm" onClick={() => { if (formRef.current?.reportValidity()) submit(new FormData(formRef.current), true); }}>Publiceren</button></div>
      </div>
      {files.length ? <p className="text-xs text-[var(--muted)]">{files.length} chart{files.length === 1 ? "" : "s"} geselecteerd · JPG, PNG of WebP · max. 10 MB per bestand</p> : null}
      <p className="text-xs text-[var(--muted)]">Publiceren maakt de update zichtbaar voor studenten met toegang en kan meldingen versturen. Bewaar als concept om eerst te controleren.</p>
      {step ? <p role="status" className="text-sm">{step}</p> : null}{notice ? <p role="status" className="text-sm text-green-700 dark:text-green-300">{notice}</p> : null}{error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </form>
  </section>;
}
