"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { PageLoadOverlay } from "@/components/PageLoadOverlay";
import { BRAND, BrandLogo } from "@/components/ui/Brand";

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-4Zm0 0v18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

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

function getNavItems(showAdminNav: boolean) {
  if (!showAdminNav) {
    return [...coreNav];
  }
  return [coreNav[0], coreNav[1], adminNavItem, coreNav[2]];
}

function SidebarContent({
  studentName,
  showAdminNav,
  onNavigate,
}: {
  studentName: string | null;
  showAdminNav: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = getNavItems(showAdminNav);

  const initials = studentName
    ? studentName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-1">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="inline-flex items-center gap-2 rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_25%,transparent)]"
        >
          <BrandLogo iconClassName="h-8 w-8" textClassName="text-[0.7rem]" />
        </Link>
      </div>

      {studentName && (
        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_1px_0_rgba(28,25,23,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,var(--border)_15%)] text-sm font-bold text-[var(--foreground)]">
              {initials || studentName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Aangemeld
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">
                {studentName}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav
        className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
        aria-label="Hoofdnavigatie"
      >
        {nav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-stone-100 hover:text-[var(--foreground)] dark:hover:bg-white/5"
          >
            Hulp nodig?
          </a>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-stone-100 hover:text-[var(--foreground)] dark:hover:bg-white/5"
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
  showAdminNav = false,
}: {
  children: React.ReactNode;
  studentName: string | null;
  /** When true, show Admin in the main nav (access level 3 — set by server layout). */
  showAdminNav?: boolean;
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
      <aside className="relative hidden h-full min-h-0 w-[272px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--background)] md:flex">
        <div className="flex h-full min-h-0 flex-col px-5 py-7">
          <SidebarContent
            studentName={studentName}
            showAdminNav={showAdminNav}
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
                className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--foreground)] dark:hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                Sluiten
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-6">
              <SidebarContent
                studentName={studentName}
                showAdminNav={showAdminNav}
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
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
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
          <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <PageLoadOverlay>{children}</PageLoadOverlay>
          </div>
        </main>
      </div>
    </div>
  );
}
