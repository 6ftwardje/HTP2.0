"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { PageLoadOverlay } from "@/components/PageLoadOverlay";
import { BRAND, BrandLogo } from "@/components/ui/Brand";

const coreNav = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/modules",
    label: "Academy",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 6.5h16M4 12h10M4 17.5h16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard#mentor",
    label: "Mentor",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Zm0-14v5l3 2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard#progress",
    label: "Progress",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 19V9m7 10V5m7 14v-7M4 19h16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "Profiel",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.015-8 4.5V21h16v-2.5C20 16.015 16.418 14 12 14Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

function SidebarContent({
  studentName,
  onNavigate,
}: {
  studentName: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = coreNav;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-1">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="inline-flex items-center gap-2 rounded-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_25%,transparent)]"
        >
          <BrandLogo iconClassName="h-7 w-7" textClassName="text-[0.66rem]" />
        </Link>
      </div>

      <nav
        className="mt-9 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
        aria-label="Hoofdnavigatie"
      >
        {nav.map((item) => {
          const itemPath = item.href.split("#")[0];
          const isActive =
            pathname === item.href ||
            (item.href === "/dashboard"
              ? pathname === "/dashboard"
              : !item.href.includes("#") && pathname.startsWith(itemPath));
          return (
            <SidebarNavItem
              key={item.href}
              href={item.href}
              label={item.label}
              active={isActive}
              icon={item.icon}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--border)] pt-5">
        <div className="flex flex-col gap-1">
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="rounded-lg px-2 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
          >
            Hulp nodig?
          </a>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            >
              Afmelden
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  studentName,
}: {
  children: React.ReactNode;
  studentName: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Desktop sidebar: vaste viewporthoogte; alleen main rechts scrollt */}
      <aside className="relative hidden h-full min-h-0 w-[252px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_96%,var(--card)_4%)] md:flex">
        <div className="flex h-full min-h-0 flex-col px-5 py-8">
          <SidebarContent
            studentName={studentName}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Menu sluiten"
            className="fixed inset-0 z-40 bg-stone-900/35 backdrop-blur-[2px] md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[min(300px,88vw)] flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--background)] shadow-2xl md:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Menu
              </span>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--foreground)] dark:hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                Sluiten
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-6">
              <SidebarContent
                studentName={studentName}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,white)] px-4 py-3 backdrop-blur-md md:hidden dark:bg-[color-mix(in_oklab,var(--background)_92%,#0c0a09)]">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Menu
          </button>
          <Link href="/dashboard" className="inline-flex items-center">
            <BrandLogo
              iconClassName="h-7 w-7"
              textClassName="hidden text-[0.62rem] min-[390px]:inline"
            />
          </Link>
          <div className="w-[72px]" aria-hidden />
        </div>

        <main
          id="mobile-nav"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <PageLoadOverlay>{children}</PageLoadOverlay>
          </div>
        </main>
      </div>
    </div>
  );
}
