import Link from "next/link";
import { MARKET_OPTIONS } from "@/lib/market-analysis";
import type { Market } from "@/lib/types";
import type { WeeklyUpdateWithMentor } from "@/lib/weekly-updates";

const categoryStyles: Record<Market, { background: string; icon: string }> = {
  forex: { background: "#E9F1FF", icon: "#5067EA" },
  crypto: { background: "#F0EAFE", icon: "#7452C8" },
  stocks: { background: "#E7F6EF", icon: "#278563" },
  commodities: { background: "#FFF2DD", icon: "#C17B22" },
};

function formatDate(value: string | null, fallback: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value ?? fallback));
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayButton({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-[#5067EA] text-white shadow-[0_8px_24px_rgba(80,103,234,0.3)] transition-transform duration-200 group-hover:scale-105 ${
        small ? "h-12 w-12" : "h-16 w-16"
      }`}
    >
      <svg
        width={small ? 17 : 22}
        height={small ? 17 : 22}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="ml-1"
      >
        <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function MarketIcon({ market, className = "h-20 w-20" }: { market: Market; className?: string }) {
  const common = {
    viewBox: "0 0 64 64",
    fill: "none",
    className,
    "aria-hidden": true,
  };

  if (market === "forex") {
    return (
      <svg {...common}>
        <path d="M17 12v40M47 12v40M10 23h14v16H10V23ZM40 18h14v25H40V18Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M32 11v42M25 29h14v18H25V29Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    );
  }

  if (market === "crypto") {
    return (
      <svg {...common}>
        <path d="m32 7 17 10v20L32 57 15 37V17L32 7Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="m32 17 10 15-10 6-10-6 10-15Zm0 21v9" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    );
  }

  if (market === "stocks") {
    return (
      <svg {...common}>
        <path d="M10 50h44M13 45l11-13 9 7 17-23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 16h10v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M32 8c8 11 15 19 15 29a15 15 0 1 1-30 0c0-10 7-18 15-29Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M25 41c2 4 6 6 11 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function VideoDate({ update }: { update: WeeklyUpdateWithMentor }) {
  return (
    <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
      <CalendarIcon />
      <time dateTime={update.published_at ?? update.created_at}>
        {formatDate(update.published_at, update.created_at)}
      </time>
    </p>
  );
}

export function MarketUpdatesLibrary({
  market,
  updates,
}: {
  market: Market;
  updates: WeeklyUpdateWithMentor[];
}) {
  const featured = updates[0] ?? null;
  const previous = updates.slice(1);
  const colors = categoryStyles[market];

  return (
    <div className="text-[var(--foreground)]">
      <header className="border-b-[0.5px] border-[var(--border)] pb-5">
        <h1 className="text-[1.7rem] font-extrabold tracking-[-0.025em]">Markt updates</h1>
      </header>

      <nav
        className="flex max-w-full gap-1 overflow-x-auto border-b-[0.5px] border-[var(--border)] pt-5"
        aria-label="Markt categorieën"
      >
        {MARKET_OPTIONS.map((option) => {
          const active = option.value === market;
          return (
            <Link
              key={option.value}
              href={`/updates/${option.value}`}
              aria-current={active ? "page" : undefined}
              className={`mb-[-0.5px] shrink-0 rounded-t-lg border-[0.5px] px-5 py-3 text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5067EA]/30 ${
                active
                  ? "border-[color-mix(in_oklab,var(--accent)_24%,var(--border))] border-b-[var(--surface-hover)] bg-[var(--surface-hover)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      {featured ? (
        <main className="pt-8">
          <section aria-labelledby="latest-update-title">
            <Link
              href={`/updates/watch/${featured.slug}`}
              className="group block overflow-hidden rounded-xl border-[0.5px] border-[var(--border)] bg-[var(--card)] transition-shadow duration-200 hover:shadow-[0_14px_38px_rgba(80,103,234,0.1)]"
            >
              <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-[#0D1B3E] sm:min-h-[350px] lg:min-h-[410px]">
                <span className="absolute left-5 top-5 z-10 rounded-md bg-[#5067EA] px-3 py-1.5 text-xs font-extrabold text-white">
                  Nieuwste
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-white/[0.12] transition-transform duration-300 group-hover:scale-105">
                  <MarketIcon market={market} className="h-44 w-44 sm:h-56 sm:w-56" />
                </span>
                <span className="relative z-10">
                  <PlayButton />
                </span>
              </div>
              <div className="p-5 sm:p-6">
                <h2 id="latest-update-title" className="text-xl font-extrabold leading-snug tracking-[-0.015em] sm:text-2xl">
                  {featured.title}
                </h2>
                <div className="mt-3">
                  <VideoDate update={featured} />
                </div>
              </div>
            </Link>
          </section>

          {previous.length > 0 ? (
            <section className="mt-10" aria-labelledby="previous-updates-title">
              <h2 id="previous-updates-title" className="text-base font-extrabold">
                Eerdere video&apos;s
              </h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {previous.map((update) => (
                  <Link
                    key={update.id}
                    href={`/updates/watch/${update.slug}`}
                    className="group overflow-hidden rounded-lg border-[0.5px] border-[var(--border)] bg-[var(--card)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#5067EA]/60 hover:shadow-[0_8px_26px_rgba(80,103,234,0.13)]"
                  >
                    <div
                      className="relative flex aspect-[16/8.5] items-center justify-center overflow-hidden"
                      style={{ backgroundColor: colors.background, color: colors.icon }}
                    >
                      <MarketIcon market={market} className="h-20 w-20 opacity-80 transition-transform duration-300 group-hover:scale-105" />
                      <span className="absolute inset-0 flex items-center justify-center bg-[#0D1B3E]/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                        <PlayButton small />
                      </span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="line-clamp-2 text-base font-extrabold leading-snug">
                        {update.title}
                      </h3>
                      <div className="mt-3">
                        <VideoDate update={update} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      ) : (
        <div className="mt-8 rounded-lg border-[0.5px] border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: colors.background, color: colors.icon }}>
            <MarketIcon market={market} className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-base font-extrabold">Nog geen updates gepubliceerd</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Nieuwe video&apos;s voor deze markt verschijnen hier automatisch.
          </p>
        </div>
      )}
    </div>
  );
}
