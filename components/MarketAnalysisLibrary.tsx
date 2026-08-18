"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import {
  getIsoWeekNumber,
  getMarketLabel,
  MARKET_OPTIONS,
} from "@/lib/market-analysis";
import type { WeeklyUpdateWithMentor } from "@/lib/weekly-updates";
import type { Market } from "@/lib/types";

type MarketFilter = "all" | Market;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatPublishedDate(value: string | null, fallback: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value ?? fallback));
}

function mentorName(
  mentor: { name: string | null; email: string } | null
): string {
  return mentor?.name ?? mentor?.email ?? "Cryptoriez mentor";
}

function PlayIcon({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full border border-white/70 bg-black/30 text-white backdrop-blur-sm transition-transform group-hover:scale-105 ${
        compact ? "h-11 w-11" : "h-16 w-16"
      }`}
    >
      <svg
        width={compact ? 16 : 23}
        height={compact ? 16 : 23}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="ml-0.5"
      >
        <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function MarketAnalysisLibrary({
  updates,
  watchedIds,
}: {
  updates: WeeklyUpdateWithMentor[];
  watchedIds: number[];
}) {
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const watched = useMemo(() => new Set(watchedIds), [watchedIds]);
  const outlooks = updates
    .filter((update) => update.type === "weekly_outlook")
    .sort((a, b) => b.week_start_date.localeCompare(a.week_start_date));
  const latestOutlook = outlooks[0] ?? null;
  const outlookArchive = outlooks.slice(1);
  const marketUpdates = updates.filter(
    (update) =>
      update.type === "market_update" &&
      (marketFilter === "all" || update.market === marketFilter)
  );

  return (
    <main className="space-y-12">
      <section aria-labelledby="weekly-outlook-title">
        <div className="mb-5 flex flex-col gap-2 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="cb-eyebrow text-[var(--accent)]">Start van de week</div>
            <h2
              id="weekly-outlook-title"
              className="mt-2 text-2xl font-extrabold text-[var(--foreground)]"
            >
              Weekly outlook
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
            De belangrijkste gebeurtenissen en voorbereiding voor stocks, forex en crypto in één analyse.
          </p>
        </div>

        {latestOutlook ? (
          <div className="grid overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_92%,var(--background)_8%)] lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
            <Link
              href={`/market-analysis/${latestOutlook.slug}`}
              className="group relative block min-h-[270px] overflow-hidden bg-black"
            >
              <CourseThumbnail
                src={latestOutlook.thumbnail_url}
                title={latestOutlook.title}
                eyebrow={`Week ${getIsoWeekNumber(latestOutlook.week_start_date)}`}
                className="aspect-[16/9] h-full w-full"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <PlayIcon />
              </span>
            </Link>
            <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cb-badge cb-badge-available">Nieuwste outlook</span>
                {watched.has(latestOutlook.id) ? (
                  <span className="cb-badge cb-badge-completed">Bekeken</span>
                ) : null}
              </div>
              <p className="mt-5 text-sm font-semibold text-[var(--muted)]">
                Week {getIsoWeekNumber(latestOutlook.week_start_date)} · {formatDate(latestOutlook.week_start_date)}
              </p>
              <h3 className="mt-2 text-3xl font-extrabold leading-tight text-[var(--foreground)]">
                {latestOutlook.title}
              </h3>
              {latestOutlook.summary ? (
                <p className="mt-4 line-clamp-3 text-[0.96rem] leading-7 text-[var(--muted)]">
                  {latestOutlook.summary}
                </p>
              ) : null}
              <p className="mt-4 cb-caption">Door {mentorName(latestOutlook.mentor)}</p>
              <Link
                href={`/market-analysis/${latestOutlook.slug}`}
                className="mt-7 w-fit cb-btn cb-btn-primary px-6 py-3"
              >
                Bekijk weekly outlook
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6">
            <p className="cb-body">Er is nog geen weekly outlook gepubliceerd.</p>
          </div>
        )}

        {outlookArchive.length > 0 ? (
          <div className="mt-7">
            <h3 className="text-base font-bold text-[var(--foreground)]">Eerdere weken</h3>
            <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {outlookArchive.map((outlook) => (
                <Link
                  key={outlook.id}
                  href={`/market-analysis/${outlook.slug}`}
                  className="group grid gap-2 py-4 transition-colors hover:bg-[var(--surface-hover)] sm:grid-cols-[135px_minmax(0,1fr)_auto] sm:items-center sm:px-3"
                >
                  <span className="text-sm font-bold text-[var(--foreground)]">
                    Week {getIsoWeekNumber(outlook.week_start_date)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--foreground)] group-hover:underline">
                      {outlook.title}
                    </span>
                    <span className="mt-0.5 block cb-caption">{formatDate(outlook.week_start_date)}</span>
                  </span>
                  <span className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
                    {watched.has(outlook.id) ? (
                      <span className="cb-badge cb-badge-completed">Bekeken</span>
                    ) : null}
                    <span aria-hidden>→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="market-updates-title">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="cb-eyebrow">Actuele ontwikkelingen</div>
            <h2
              id="market-updates-title"
              className="mt-2 text-2xl font-extrabold text-[var(--foreground)]"
            >
              Markt updates
            </h2>
          </div>
          <div
            className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-[color-mix(in_oklab,var(--card)_72%,var(--background)_28%)] p-1"
            role="tablist"
            aria-label="Filter markt updates"
          >
            {[
              { value: "all" as const, label: "Alle markten" },
              ...MARKET_OPTIONS,
            ].map((option) => {
              const active = marketFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMarketFilter(option.value)}
                  className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {marketUpdates.length > 0 ? (
          <div className="mt-5 grid gap-x-5 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
            {marketUpdates.map((update) => (
              <Link
                key={update.id}
                href={`/market-analysis/${update.slug}`}
                className="group min-w-0"
              >
                <div className="relative overflow-hidden rounded-xl bg-black">
                  <CourseThumbnail
                    src={update.thumbnail_url}
                    title={update.title}
                    eyebrow={getMarketLabel(update.market)}
                    className="aspect-[16/9] w-full transition-transform duration-300 group-hover:scale-[1.015]"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <PlayIcon compact />
                  </span>
                  <span className="absolute left-3 top-3 rounded-full border border-white/35 bg-black/65 px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                    {getMarketLabel(update.market)}
                  </span>
                </div>
                <div className="pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="cb-caption">
                      {formatPublishedDate(update.published_at, update.created_at)}
                    </p>
                    {watched.has(update.id) ? (
                      <span className="cb-badge cb-badge-completed">Bekeken</span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug text-[var(--foreground)] group-hover:underline">
                    {update.title}
                  </h3>
                  <p className="mt-2 cb-caption">{mentorName(update.mentor)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] p-6">
            <p className="cb-body">Voor deze markt zijn nog geen updates gepubliceerd.</p>
          </div>
        )}
      </section>
    </main>
  );
}
