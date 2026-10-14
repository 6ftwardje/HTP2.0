"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import { PageLoadOverlay } from "@/components/PageLoadOverlay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/ui/Brand";
import { useMobileDrawer } from "@/components/useMobileDrawer";

const adminNav = [
  {
    href: "/admin",
    label: "Overzicht",
    icon: <NavigationIcon name="dashboard" />,
  },
  {
    href: "/admin/students",
    label: "Studenten",
    icon: <NavigationIcon name="students" />,
  },
  {
    href: "/admin/mentor-inbox",
    label: "Mentor-inbox",
    icon: <NavigationIcon name="mentor" />,
  },
  {
    href: "/admin/exams",
    label: "Examens",
    icon: <NavigationIcon name="exams" />,
  },
  {
    href: "/admin/videos",
    label: "Lesvideo's",
    icon: <NavigationIcon name="lessons" />,
  },
  {
    href: "/admin/live-sessions",
    label: "Live marktsessies",
    icon: <NavigationIcon name="live" />,
  },
  {
    href: "/admin/market-analysis",
    label: "Marktinzicht",
    icon: <NavigationIcon name="market" />,
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
            Ingelogd als
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
            {studentName}
          </div>
        </div>
      )}

      <nav
        className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
        aria-label="Beheermenu"
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
          className="mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold tracking-tight text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <NavigationIcon name="academy" />
          </span>
          <span>Naar Academy</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold tracking-tight text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <NavigationIcon name="logout" />
            </span>
            <span>Uitloggen</span>
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
  const { mobileOpen, menuTriggerRef, menuCloseRef, menuPanelRef, openMobileMenu, closeMobileMenu } = useMobileDrawer();
  const pathname = usePathname();
  const isWideWorkspace = pathname.startsWith("/admin/videos");

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <aside className="relative hidden h-full min-h-0 w-[272px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_72%,var(--card)_28%)] md:flex">
        <div className="flex h-full min-h-0 flex-col px-5 py-7">
          <SidebarContent
            studentName={studentName}
            onNavigate={() => closeMobileMenu(false)}
          />
        </div>
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Menu sluiten"
            className="fixed inset-0 z-40 bg-stone-900/35 backdrop-blur-[2px] md:hidden"
            onClick={() => closeMobileMenu()}
          />
          <aside ref={menuPanelRef} id="admin-mobile-nav" role="dialog" aria-modal="true" aria-label="Beheermenu" className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[min(300px,88vw)] flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--background)] shadow-2xl md:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Beheermenu
              </span>
              <button
                ref={menuCloseRef}
                type="button"
                className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                onClick={() => closeMobileMenu()}
              >
                Sluiten
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-6">
              <SidebarContent
                studentName={studentName}
                onNavigate={() => closeMobileMenu(false)}
              />
            </div>
          </aside>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none fixed right-6 top-5 z-30 hidden md:block">
          <ThemeToggle className="pointer-events-auto" />
        </div>

        <div className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_82%,var(--card)_18%)] px-4 py-3 backdrop-blur-md md:hidden">
          <button
            ref={menuTriggerRef}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
            onClick={openMobileMenu}
            aria-expanded={mobileOpen}
            aria-controls="admin-mobile-nav"
          >
            <NavigationIcon name="menu" />
            Menu
          </button>
          <Link href="/admin" className="inline-flex items-center">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Admin
            </span>
          </Link>
          <ThemeToggle />
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className={
              isWideWorkspace
                ? "w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
                : "mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
            }
          >
            <PageLoadOverlay>{children}</PageLoadOverlay>
          </div>
        </main>
      </div>
    </div>
  );
}
