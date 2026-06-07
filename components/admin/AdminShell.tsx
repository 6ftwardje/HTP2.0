"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { PageLoadOverlay } from "@/components/PageLoadOverlay";
import { BrandLogo } from "@/components/ui/Brand";

const adminNav = [
  {
    href: "/admin",
    label: "Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 14.5 12 8l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-5.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/students",
    label: "Students",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/videos",
    label: "Videos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4.5 6.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM16.5 10l5-2.5v9l-5-2.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function SidebarContent({
  studentName,
  onNavigate,
}: {
  studentName: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="inline-flex items-center gap-2 rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_25%,transparent)]"
        >
          <BrandLogo logoClassName="h-auto w-[188px]" />
        </Link>
      </div>

      <div className="mt-6">
        <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_90%,var(--foreground)_4%)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Admin
        </span>
      </div>

      {studentName && (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_1px_0_rgba(28,25,23,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            Signed in
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
            {studentName}
          </div>
        </div>
      )}

      <nav
        className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
        aria-label="Admin"
      >
        {adminNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
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
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="mb-2 block rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-stone-100 hover:text-[var(--foreground)] dark:hover:bg-white/5"
        >
          ← Back to Academy
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-stone-100 hover:text-[var(--foreground)] dark:hover:bg-white/5"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminShell({
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
      <aside className="relative hidden h-full min-h-0 w-[272px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--background)] md:flex">
        <div className="flex h-full min-h-0 flex-col px-5 py-7">
          <SidebarContent
            studentName={studentName}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-stone-900/35 backdrop-blur-[2px] md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[min(300px,88vw)] flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--background)] shadow-2xl md:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Admin menu
              </span>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--foreground)] dark:hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                Close
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
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
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
          <Link href="/admin" className="inline-flex items-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Admin
            </span>
          </Link>
          <div className="w-[72px]" aria-hidden />
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <PageLoadOverlay>{children}</PageLoadOverlay>
          </div>
        </main>
      </div>
    </div>
  );
}
