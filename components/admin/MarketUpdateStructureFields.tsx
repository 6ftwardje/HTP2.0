"use client";

import { useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  CATEGORY_OPTIONS,
  FIELD_LIMITS,
  PERSPECTIVE_OPTIONS,
  TEMPLATE_FIELDS,
  UPDATE_TYPE_OPTIONS,
  categoryLabel,
  emptyStructure,
  getUpdateStructure,
  getUpdateCategory,
  getUpdateMarkets,
  setupStatusLabel,
  updateTypeLabel,
  type MarketUpdateStructure,
} from "@/lib/market-update-structure";
import type { UpdateMarket } from "@/lib/types";
import type { AdminWeeklyUpdateRow } from "@/lib/admin/weekly-updates";

const inputClass = "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const labelClass = "block text-sm font-semibold text-[var(--foreground)]";

function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, "Europe/Brussels", "yyyy-MM-dd'T'HH:mm");
}

function isoDateTime(value: string) {
  if (!value) return null;
  const date = fromZonedTime(value, "Europe/Brussels");
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function MarketUpdateStructureFields({
  update,
  includeBasics = true,
}: {
  update?: AdminWeeklyUpdateRow;
  includeBasics?: boolean;
}) {
  const [structure, setStructure] = useState<MarketUpdateStructure>(() => getUpdateStructure(update) ?? { ...emptyStructure(), category: update ? getUpdateCategory(update) ?? "general" : "general" });
  const [markets, setMarkets] = useState<UpdateMarket[]>(() => getUpdateMarkets(update));
  const [title, setTitle] = useState(update?.title ?? "");
  const [summary, setSummary] = useState(update?.summary ?? "");
  const fields = TEMPLATE_FIELDS[structure.type];
  const wasPublished = Boolean(update?.is_published || getUpdateStructure(update)?.history.some((event) => event.kind === "published"));
  const setupHasProgress = structure.type === "setup" && (structure.setup_status !== "waiting" || structure.targets.some((target) => target.reached_at));
  const typeLocked = Boolean(setupHasProgress || (wasPublished && getUpdateStructure(update)));

  function patch(value: Partial<MarketUpdateStructure>) {
    setStructure((previous) => ({ ...previous, ...value }));
  }

  function setField(key: string, value: string) {
    setStructure((previous) => ({ ...previous, fields: { ...previous.fields, [key]: value } }));
  }

  return <div className="min-w-0 space-y-5">
    <input type="hidden" name="update_structure" value={JSON.stringify({ ...structure, targets: structure.targets.filter((target) => target.label.trim()) })} />
    <div className="grid gap-3 sm:grid-cols-2">
      <fieldset className="min-w-0 space-y-2">
        <legend className={labelClass}>Markten</legend>
        <input type="hidden" name="markets_present" value="1" />
        <div className="flex flex-wrap gap-2">{CATEGORY_OPTIONS.map((option) => <label key={option.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
          <input name="markets" type="checkbox" value={option.value} checked={markets.includes(option.value)} onChange={(event) => {
            const next = event.target.checked ? [...markets, option.value] : markets.filter((market) => market !== option.value);
            setMarkets(next);
            if (next.length) patch({ category: next[0] });
          }} />{option.label}
        </label>)}</div>
      </fieldset>
      <label className="min-w-0 space-y-1.5">
        <span className={labelClass}>Type update</span>
        <select value={structure.type} disabled={typeLocked} onChange={(event) => {
          const type = event.target.value as MarketUpdateStructure["type"];
          patch({ type, fields: Object.fromEntries(TEMPLATE_FIELDS[type].map((field) => [field.key, structure.fields[field.key] ?? ""])), perspective: type === "setup" || type === "analysis" ? structure.perspective : null, setup_status: type === "setup" ? "waiting" : null, close_reason: null, closed_at: null, targets: type === "setup" ? [{ label: "", reached_at: null }] : [] });
        }} className={inputClass}>
          {UPDATE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {typeLocked ? <span className="block text-xs leading-5 text-[var(--muted)]">Een gepubliceerd bericht behoudt zijn sjabloon. Dupliceer voor een nieuw scenario.</span> : null}
      </label>
    </div>

    {includeBasics ? <div className="space-y-3">
      <label className="block space-y-1.5"><span className={labelClass}>Titel</span><input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={100} placeholder="Instrument en onderwerp in één duidelijke titel" className={inputClass} /><span className="block text-right text-xs tabular-nums text-[var(--muted)]">{title.length}/100</span></label>
      <label className="block space-y-1.5"><span className={labelClass}>Kernboodschap <span className="font-normal text-[var(--muted)]">· verplicht bij publiceren</span></span><textarea name="summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} maxLength={240} placeholder="Wat moet de lezer meteen begrijpen?" className={inputClass} /><span className="block text-right text-xs tabular-nums text-[var(--muted)]">{summary.length}/240</span></label>
    </div> : null}

    {structure.type === "setup" || structure.type === "analysis" ? <label className="block space-y-1.5"><span className={labelClass}>Invalshoek <span className="font-normal text-[var(--muted)]">· optioneel</span></span><select value={structure.perspective ?? ""} onChange={(event) => patch({ perspective: (event.target.value || null) as MarketUpdateStructure["perspective"] })} className={inputClass}><option value="">Geen invalshoek gekozen</option>{PERSPECTIVE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}

    <fieldset className="min-w-0 space-y-3 border-t border-[var(--border)] pt-4">
      <legend className="px-1 text-base font-semibold">{updateTypeLabel(structure.type)} · inhoud</legend>
      <p className="text-xs leading-5 text-[var(--muted)]">Velden met * zijn nodig bij publiceren. Een concept mag onvolledig blijven.</p>
      {fields.map((field) => <label key={field.key} className="block min-w-0 space-y-1.5">
        <span className={labelClass}>{field.label}{field.required ? " *" : ""}</span>
        {field.key === "direction" ? <select value={structure.fields[field.key] ?? ""} disabled={Boolean(wasPublished && getUpdateStructure(update)?.type === "setup")} onChange={(event) => setField(field.key, event.target.value)} className={inputClass}><option value="">Kies richting</option><option value="long">Long</option><option value="short">Short</option></select> : field.multiline ? <textarea value={structure.fields[field.key] ?? ""} onChange={(event) => setField(field.key, event.target.value)} maxLength={FIELD_LIMITS[field.key]} rows={3} className={inputClass} /> : <input type={field.type ?? "text"} value={field.type === "datetime-local" ? localDateTime(structure.fields[field.key]) : structure.fields[field.key] ?? ""} disabled={Boolean(field.key === "instrument" && wasPublished && getUpdateStructure(update)?.type === "setup")} onChange={(event) => setField(field.key, field.type === "datetime-local" ? isoDateTime(event.target.value) ?? "" : event.target.value)} maxLength={field.type === "datetime-local" ? undefined : FIELD_LIMITS[field.key]} className={inputClass} />}
        {field.help || field.type === "datetime-local" ? <span className="block text-xs leading-5 text-[var(--muted)]">{field.help}{field.type === "datetime-local" ? " Datum en tijd in Brussel." : ""}{wasPublished && getUpdateStructure(update)?.type === "setup" && ["instrument", "direction"].includes(field.key) ? " Gebruik een nieuwe setup voor een ander instrument of een andere richting." : ""}</span> : null}
      </label>)}
      {structure.type === "setup" ? <fieldset className="space-y-2 pt-1"><legend className={labelClass}>Doelen * <span className="font-normal text-[var(--muted)]">· maximaal drie</span></legend>
        {(structure.targets.length ? structure.targets : [{ label: "", reached_at: null }]).map((target, index) => (
          <div key={index} className="flex min-w-0 items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Doel {index + 1}</span>
              <input
                value={target.label}
                placeholder={`Doel ${index + 1}: prijsniveau of voorwaarde`}
                maxLength={240}
                disabled={Boolean(target.reached_at)}
                onChange={(event) => {
                  const targets = structure.targets.length ? [...structure.targets] : [{ label: "", reached_at: null }];
                  targets[index] = { ...targets[index], label: event.target.value };
                  patch({ targets });
                }}
                className={inputClass}
              />
            </label>
            {target.reached_at ? <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">Bereikt</span> : structure.targets.length > 1 ? (
              <button
                type="button"
                aria-label={`Doel ${index + 1} verwijderen`}
                disabled={structure.targets.slice(index + 1).some((laterTarget) => laterTarget.reached_at)}
                onClick={() => patch({ targets: structure.targets.filter((_, itemIndex) => itemIndex !== index) })}
                className="min-h-11 px-2 text-sm text-[var(--muted)] disabled:opacity-40"
              >Verwijder</button>
            ) : null}
          </div>
        ))}
        {structure.targets.length < 3 ? <button type="button" onClick={() => patch({ targets: [...(structure.targets.length ? structure.targets : [{ label: "", reached_at: null }]), { label: "", reached_at: null }] })} className="cb-btn cb-btn-secondary min-h-10 text-xs">Doel toevoegen</button> : null}
        <p className="text-xs leading-5 text-[var(--muted)]">De setup start met ‘Wacht op entry’. Entry, doelen en afsluiting werk je na publicatie bij via Opvolging.</p>
      </fieldset> : null}
    </fieldset>

    <details className="border-t border-[var(--border)] pt-4">
      <summary className="cursor-pointer py-1 text-sm font-semibold">Zichtbaarheid · vastzetten en urgentie</summary>
      <div className="mt-3 space-y-3">
        <label className="block space-y-1.5"><span className={labelClass}>Vastzetten</span><select value={structure.pinned_rank ?? ""} onChange={(event) => patch({ pinned_rank: event.target.value ? Number(event.target.value) as 1 | 2 : null, pin_until: event.target.value ? structure.pin_until : null })} className={inputClass}><option value="">Niet vastzetten</option><option value="1">Bovenaan · positie 1</option><option value="2">Bovenaan · positie 2</option></select><span className="block text-xs leading-5 text-[var(--muted)]">Kies een vrije positie. Maak een bestaande pin eerst vrij.</span></label>
        {structure.pinned_rank ? <label className="block space-y-1.5"><span className={labelClass}>Vastzetten tot <span className="font-normal text-[var(--muted)]">· optioneel, tijd in Brussel</span></span><input type="datetime-local" value={localDateTime(structure.pin_until)} onChange={(event) => patch({ pin_until: isoDateTime(event.target.value) })} className={inputClass} /></label> : null}
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(structure.urgent_until)} onChange={(event) => patch({ urgent_until: event.target.checked ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null })} />Tijdelijk urgent markeren</label>
        {structure.urgent_until ? <label className="block space-y-1.5"><span className={labelClass}>Urgent tot <span className="font-normal text-[var(--muted)]">· tijd in Brussel</span></span><input type="datetime-local" value={localDateTime(structure.urgent_until)} onChange={(event) => patch({ urgent_until: isoDateTime(event.target.value) })} className={inputClass} /><span className="block text-xs leading-5 text-[var(--muted)]">Alleen het label vervalt; de update blijft beschikbaar.</span></label> : null}
      </div>
    </details>

    {wasPublished ? <label className="block space-y-1.5 border-t border-[var(--border)] pt-4"><span className={labelClass}>Wijzigingsnotitie</span><textarea name="change_note" rows={2} maxLength={2000} placeholder="Wat veranderde aan het scenario of de centrale analyse, en waarom?" className={inputClass} /><span className="block text-xs leading-5 text-[var(--muted)]">Verplicht bij wijzigingen aan setupniveaus, entryvoorwaarden, kernboodschap of onderbouwing, en bij wijzigingen aan de conclusie, onderbouwing of invalidatie van een analyse. De notitie verschijnt in de opvolging en maakt de update opnieuw actueel. Een taalcorrectie in de titel of aanvullende tekst vereist geen notitie.</span></label> : null}

    {includeBasics ? <details className="border-t border-[var(--border)] pt-4"><summary className="cursor-pointer py-1 text-sm font-semibold">Voorbeeldweergave</summary><div className="mt-3 space-y-2"><p className="text-xs font-semibold text-[var(--muted)]">{markets.map(categoryLabel).join(" · ") || "Kies markten"} · {updateTypeLabel(structure.type)}{structure.type === "setup" ? ` · ${setupStatusLabel(structure.setup_status)}` : ""}</p><h3 className="break-words text-lg font-semibold">{title || "Titel van je update"}</h3><p className="whitespace-pre-line break-words text-sm leading-6">{summary || "Je kernboodschap verschijnt hier."}</p><dl className="space-y-2 border-t border-[var(--border)] pt-3 text-sm">{fields.filter((field) => structure.fields[field.key]).map((field) => <div key={field.key}><dt className="font-semibold">{field.label}</dt><dd className="whitespace-pre-line break-words text-[var(--muted)]">{structure.fields[field.key]}</dd></div>)}{structure.type === "setup" ? structure.targets.filter((target) => target.label).map((target, index) => <div key={index}><dt className="font-semibold">Doel {index + 1}</dt><dd className="break-words text-[var(--muted)]">{target.label}</dd></div>) : null}</dl></div></details> : null}
  </div>;
}
