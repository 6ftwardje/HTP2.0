"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { adminRemoveChartImage } from "@/app/actions/admin/weekly-updates";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import type { AdminWeeklyUpdateRow } from "@/lib/admin/weekly-updates";
import {
  getIsoWeekNumber,
  getMarketAnalysisTypeLabel,
  MARKET_ANALYSIS_TYPE_OPTIONS,
  MARKET_OPTIONS,
} from "@/lib/market-analysis";
import type {
  MarketAnalysisType,
  Student,
  WeeklyUpdateContentFormat,
} from "@/lib/types";
import { WEEKLY_UPDATE_ACCESS_OPTIONS } from "@/lib/weekly-update-access";

export type MentorOption = Pick<Student, "id" | "name" | "email">;

function fieldClass() {
  return "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border))]";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ThumbnailField({
  update,
  onFileChange,
}: {
  update?: AdminWeeklyUpdateRow;
  onFileChange: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    update?.thumbnail_url ?? null
  );
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(update?.thumbnail_url ?? null);
  }, [update?.thumbnail_url]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_86%,var(--card)_14%)]">
      <CourseThumbnail
        src={previewUrl}
        title={update?.title ?? "Marktanalyse thumbnail"}
        eyebrow={getMarketAnalysisTypeLabel(update?.type ?? null)}
        className="aspect-[16/9] w-full"
      />
      <div className="grid gap-3 p-3">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Thumbnail URL
          </span>
          <input
            name="thumbnail_url"
            defaultValue={update?.thumbnail_url ?? ""}
            placeholder="https://..."
            className={fieldClass()}
            onChange={(event) =>
              setPreviewUrl(event.currentTarget.value.trim() || null)
            }
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Afbeelding uploaden
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--background)]"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              onFileChange(file);
              if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
              }
              if (!file) {
                setPreviewUrl(update?.thumbnail_url ?? null);
                return;
              }
              const nextUrl = URL.createObjectURL(file);
              objectUrlRef.current = nextUrl;
              setPreviewUrl(nextUrl);
            }}
          />
        </label>
      </div>
    </div>
  );
}

export function WeeklyUpdateFields({
  update,
  mentors,
  paidProductsActive,
  onThumbnailFileChange,
  onContentFormatChange,
  chartFileRef,
}: {
  update?: AdminWeeklyUpdateRow;
  mentors: MentorOption[];
  paidProductsActive: boolean;
  onThumbnailFileChange: (file: File | null) => void;
  onContentFormatChange: (format: WeeklyUpdateContentFormat) => void;
  chartFileRef: RefObject<HTMLInputElement>;
}) {
  const [analysisType, setAnalysisType] = useState<MarketAnalysisType | "">(
    update?.type ?? ""
  );
  const [contentFormat, setContentFormat] = useState<WeeklyUpdateContentFormat>(update?.content_format ?? "video");

  useEffect(() => {
    setAnalysisType(update?.type ?? "");
    setContentFormat(update?.content_format ?? "video");
  }, [update?.id, update?.type, update?.content_format]);

  if (contentFormat !== "video") {
    return <div className="grid gap-4">
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Soort update</span><select name="content_format" value={contentFormat} disabled={Boolean(update?.is_published || update?.image_paths.length)} onChange={(event) => { const format = event.target.value as WeeklyUpdateContentFormat; setContentFormat(format); onContentFormatChange(format); }} className={fieldClass()}><option value="text">Tekstbericht</option><option value="chart">Chart met bericht</option><option value="video">Video</option></select>{update && (update.is_published || update.image_paths.length > 0) ? <input type="hidden" name="content_format" value={contentFormat} /> : null}</label>
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Titel</span><input name="title" defaultValue={update?.title ?? ""} required className={fieldClass()} /></label>
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Bericht</span><textarea name="body" defaultValue={update?.body ?? ""} required minLength={20} maxLength={12000} rows={8} placeholder="Wat speelt er op de markt?" className={fieldClass()} /></label>
      <label className="space-y-1.5"><span className="text-sm font-semibold">Introductie (optioneel)</span><textarea name="intro" defaultValue={update?.intro ?? ""} rows={3} className={fieldClass()} /></label>
      <details open={Boolean(update?.article_html?.trim())} className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <summary className="cursor-pointer text-sm font-semibold">Artikelopmaak (optioneel)</summary>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">Artikelinhoud</span><textarea name="article_html" defaultValue={update?.article_html ?? ""} rows={12} maxLength={250000} className={fieldClass()} /><span className="block text-xs leading-5 text-[var(--muted)]">HTML met alinea’s, koppen, lijsten en afbeeldingen in de gewenste volgorde. Zonder artikelinhoud wordt het bericht met eventuele charts getoond.</span></label>
      </details>
      <fieldset className="space-y-2"><legend className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Markten</legend><div className="flex flex-wrap gap-2">{[...MARKET_OPTIONS, { value: "macro" as const, label: "Macro" }].map((option) => <label key={option.value} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"><input name="markets" type="checkbox" value={option.value} defaultChecked={update?.markets?.includes(option.value) || update?.market === option.value} />{option.label}</label>)}</div></fieldset>
      {contentFormat === "chart" ? <div className="space-y-2 rounded-xl border border-[var(--border)] p-3"><label className="block space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Charts (1–4, max. 10 MB)</span><input ref={chartFileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={update?.is_published} className={fieldClass()} /></label>{update?.image_paths.map((path, index) => <div key={path} className="flex items-center gap-3"><img src={`/api/market-updates/${update.id}/images/${index}`} alt={`Chart ${index + 1}`} className="h-20 w-32 rounded object-contain" /><span className="text-xs">Chart {index + 1}</span>{!update.is_published ? <button type="button" className="cb-btn cb-btn-secondary text-xs" onClick={async () => { const result = await adminRemoveChartImage(update.id, path); if (result.success) window.location.reload(); }}>Verwijder</button> : null}</div>)}</div> : null}
      <input type="hidden" name="type" value="market_update" /><input type="hidden" name="access_tier" value={update?.access_tier ?? "subscription"} /><input type="hidden" name="slug" value={update?.slug ?? ""} /><input type="hidden" name="market" value={update?.market ?? ""} /><input type="hidden" name="mentor_student_id" value={update?.mentor_student_id ?? ""} /><input type="hidden" name="actuality_status" value={update?.actuality_status ?? "current"} /><input type="hidden" name="summary" value={update?.summary ?? ""} /><input type="hidden" name="key_takeaways" value={(update?.key_takeaways ?? []).join("\n")} /><input type="hidden" name="event_context" value={update?.event_context ?? ""} /><input type="hidden" name="period_label" value={update?.period_label ?? ""} /><input type="hidden" name="related_content" value={(update?.related_content ?? []).map((item) => `${item.label} | ${item.href}`).join("\n")} />
      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5"><input name="is_published" type="checkbox" defaultChecked={update?.is_published ?? false} disabled={!update} /><span className="text-sm font-semibold">{update ? "Gepubliceerd" : "Eerst als concept opslaan; daarna publiceren"}</span></label>
    </div>;
  }

  return (
    <div className="grid gap-3">
      {contentFormat === "video" ? <ThumbnailField update={update} onFileChange={onThumbnailFileChange} /> : null}
      <label className="space-y-1.5"><span className="text-sm font-semibold">Introductie (optioneel)</span><textarea name="intro" defaultValue={update?.intro ?? ""} rows={3} className={fieldClass()} /></label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Inhoudsformaat</span>
        <select name="content_format" value={contentFormat} onChange={(event) => { const format = event.target.value as WeeklyUpdateContentFormat; setContentFormat(format); onContentFormatChange(format); if (format !== "video") setAnalysisType("market_update"); }} disabled={Boolean(update?.is_published || update?.mux_upload_id || update?.image_paths.length)} className={fieldClass()}>
          <option value="video">Video</option><option value="chart">Chart met duiding</option><option value="text">Tekstupdate</option>
        </select>
        {update && (update.is_published || update.mux_upload_id || update.image_paths.length > 0) ? <input type="hidden" name="content_format" value={contentFormat} /> : null}
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Format <span className="text-red-600">*</span>
        </span>
        <select
          name="type"
          value={analysisType}
          required
          className={fieldClass()}
          onChange={(event) =>
            setAnalysisType(event.currentTarget.value as MarketAnalysisType | "")
          }
        >
          <option value="" disabled>Kies format</option>
          {MARKET_ANALYSIS_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} disabled={contentFormat !== "video" && option.value !== "market_update"}>{option.label}</option>
          ))}
        </select>
        <span className="block text-xs leading-5 text-[var(--muted)]">
          Kies Weekvooruitblik of Marktbreakdown. Live marktsessies plan je in het livebeheer.
        </span>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Markten {analysisType === "market_update" ? <span className="text-red-600">*</span> : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {[...MARKET_OPTIONS, { value: "macro" as const, label: "Macro" }].map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <input name="markets" type="checkbox" value={option.value} defaultChecked={update?.markets?.includes(option.value) || update?.market === option.value} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {analysisType === "market_update" ? (
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Event of aanleiding
          </span>
          <input name="event_context" defaultValue={update?.event_context ?? ""} placeholder="Bijv. rentebesluit ECB" className={fieldClass()} />
        </label>
      ) : <input type="hidden" name="event_context" value={update?.event_context ?? ""} />}
      <input type="hidden" name="market" value={update?.market ?? ""} />
      {analysisType === "weekly_outlook" ? (
        <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_72%,var(--background)_28%)] px-3 py-2.5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Week & publicatie</div>
          <p className="mt-1 text-sm text-[var(--foreground)]">
            {update?.week_start_date
              ? `Week ${getIsoWeekNumber(update.week_start_date)} · ${formatDate(update.week_start_date)}`
              : "Weeknummer en maandagdatum worden automatisch gekoppeld."}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">De publicatiedatum wordt vastgelegd bij publiceren.</p>
          <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Week of periode</span><input name="period_label" defaultValue={update?.period_label ?? ""} placeholder="Bijv. Week 39" className={fieldClass()} /></label>
        </div>
      ) : <input type="hidden" name="period_label" value={update?.period_label ?? ""} />}
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Titel
        </span>
        <input name="title" defaultValue={update?.title ?? ""} required className={fieldClass()} />
      </label>
      <div className="grid gap-3">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Slug
          </span>
          <input name="slug" defaultValue={update?.slug ?? ""} placeholder="Automatisch op basis van de titel" className={fieldClass()} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Host
          </span>
          <select name="mentor_student_id" defaultValue={update?.mentor_student_id ?? ""} className={fieldClass()}>
            <option value="">Geen mentor</option>
            {mentors.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>
                {mentor.name ?? mentor.email}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Toegang
          </span>
          <select name="access_tier" defaultValue={update?.access_tier ?? "subscription"} className={fieldClass()}>
            {WEEKLY_UPDATE_ACCESS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={!option.selectable}
              >
                {option.value === "subscription" && !paidProductsActive ? "Academy" : option.label}
              </option>
            ))}
          </select>
          <span className="block text-xs leading-5 text-[var(--muted)]">
            Kies ‘Iedereen op het platform (ook free)’ om deze video ook voor free accounts beschikbaar te maken.
            {paidProductsActive
              ? " Subscription vereist een actief abonnement."
              : " Academy is voor toegangsniveau 2 of 3."}
          </span>
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Korte omschrijving / samenvatting
        </span>
        <textarea name="summary" defaultValue={update?.summary ?? ""} rows={4} className={fieldClass()} />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Actualiteitsstatus</span>
        <select name="actuality_status" defaultValue={update?.actuality_status ?? "current"} className={fieldClass()}>
          <option value="current">Actueel</option><option value="still_relevant">Nog relevant</option><option value="archive">Archief</option>
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Belangrijke scenario&apos;s of aandachtspunten
        </span>
        <textarea
          name="key_takeaways"
          defaultValue={(update?.key_takeaways ?? []).join("\n")}
          rows={5}
          placeholder="Eén aandachtspunt per regel"
          className={fieldClass()}
        />
      </label>
      {contentFormat === "video" ? <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Hoofdstukken / timestamps</span><textarea name="chapters" defaultValue={(update?.chapters ?? []).map((chapter) => `${Math.floor(chapter.seconds / 60)}:${String(chapter.seconds % 60).padStart(2, "0")} ${chapter.title}`).join("\n")} rows={4} placeholder="00:00 Introductie" className={fieldClass()} /></label> : null}
      <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Gerelateerde content</span><textarea name="related_content" defaultValue={(update?.related_content ?? []).map((item) => `${item.label} | ${item.href}`).join("\n")} rows={3} placeholder="Les risicobeheer | /lessons/risicobeheer" className={fieldClass()} /></label>
      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
        <input name="is_published" type="checkbox" defaultChecked={update?.is_published ?? false} disabled={!update} className="h-4 w-4" />
        <span className="text-sm font-semibold text-[var(--foreground)]">{update ? "Gepubliceerd" : "Eerst als concept opslaan; daarna publiceren"}</span>
      </label>
    </div>
  );
}
