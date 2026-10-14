"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import { PageLoadOverlay } from "@/components/PageLoadOverlay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BRAND, BrandLogo } from "@/components/ui/Brand";
import {
  NotificationPopover,
  type FloatingNotification,
} from "@/components/ui/notification-popover";
import { ADMIN_ACCESS_LEVEL } from "@/lib/admin/constants";
import { useNotificationsRealtime } from "@/lib/realtime-hooks";
import { useMobileDrawer } from "@/components/useMobileDrawer";

const coreNav = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <NavigationIcon name="dashboard" />,
  },
  {
    href: "/modules",
    label: "Academy",
    icon: <NavigationIcon name="academy" />,
  },
  {
    href: "/mentor",
    label: "Mentor",
    icon: <NavigationIcon name="mentor" />,
  },
  {
    href: "/notifications",
    label: "Meldingen",
    icon: <NavigationIcon name="notifications" />,
  },
  {
    href: "/account",
    label: "Profiel",
    icon: <NavigationIcon name="profile" />,
  },
] as const;

const updatesNav = [
  {
    href: "/market-analysis",
    label: "Marktinzicht",
    icon: <NavigationIcon name="market" />,
  },
  {
    href: "/live-sessions",
    label: "Live marktsessies",
    icon: <NavigationIcon name="live" />,
  },
] as const;

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  icon: <NavigationIcon name="admin" />,
} as const;

function SidebarContent({
  studentName,
  accessLevel,
  unreadNotificationCount,
  onNavigate,
}: {
  studentName: string | null;
  accessLevel: number | null;
  unreadNotificationCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav =
    accessLevel === ADMIN_ACCESS_LEVEL
      ? [...coreNav.slice(0, -1), adminNavItem, coreNav[coreNav.length - 1]]
      : coreNav;

  function isNavItemActive(href: string) {
    if (href === "/market-analysis") {
      return pathname.startsWith("/market-analysis") || pathname.startsWith("/updates");
    }
    return (
      pathname === href ||
      (href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(`${href}/`))
    );
  }

  function renderNavItem(item: (typeof nav)[number] | (typeof updatesNav)[number]) {
    return (
      <SidebarNavItem
        key={item.href}
        href={item.href}
        label={
          item.href === "/notifications" && unreadNotificationCount > 0
            ? `${item.label} (${Math.min(unreadNotificationCount, 99)})`
            : item.label
        }
        active={isNavItemActive(item.href)}
        icon={item.icon}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-1">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="inline-flex items-center gap-2 rounded-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--foreground)_25%,transparent)]"
        >
          <BrandLogo logoClassName="h-auto w-[176px]" />
        </Link>
      </div>

      <nav
        className="mt-9 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
        aria-label="Hoofdnavigatie"
      >
        {nav.slice(0, 3).map(renderNavItem)}

        {accessLevel !== null ? (
          <>
            <div className="mb-1 mt-6 px-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Updates
            </div>
            {updatesNav
              .filter((item) => item.href === "/market-analysis" || accessLevel >= 2)
              .map(renderNavItem)}
          </>
        ) : null}

        <div className="mt-5 flex flex-col gap-1">
          {nav.slice(3).map(renderNavItem)}
        </div>
      </nav>

      <div className="mt-auto border-t-[0.5px] border-[var(--border)] pt-5">
        <div className="flex flex-col gap-1">
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold tracking-tight text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <NavigationIcon name="help" />
            </span>
            <span>Hulp nodig?</span>
          </a>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold tracking-tight text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                <NavigationIcon name="logout" />
              </span>
              <span>Afmelden</span>
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
  accessLevel,
  currentStudentId = null,
  unreadNotificationCount = 0,
  floatingNotifications = [],
}: {
  children: React.ReactNode;
  studentName: string | null;
  accessLevel: number | null;
  currentStudentId?: string | null;
  unreadNotificationCount?: number;
  floatingNotifications?: FloatingNotification[];
}) {
  const { mobileOpen, menuTriggerRef, menuCloseRef, menuPanelRef, openMobileMenu, closeMobileMenu } = useMobileDrawer();
  const pathname = usePathname();
  const showFloatingNotifications = pathname !== "/notifications";

  useNotificationsRealtime(currentStudentId);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Desktop sidebar: vaste viewporthoogte; alleen main rechts scrollt */}
      <aside className="relative hidden h-full min-h-0 w-[252px] shrink-0 flex-col overflow-hidden border-r-[0.5px] border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_72%,var(--card)_28%)] text-[var(--foreground)] md:flex">
        <div className="flex h-full min-h-0 flex-col px-5 py-8">
          <SidebarContent
            studentName={studentName}
            accessLevel={accessLevel}
            unreadNotificationCount={unreadNotificationCount}
            onNavigate={() => closeMobileMenu(false)}
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
            onClick={() => closeMobileMenu()}
          />
          <aside ref={menuPanelRef} id="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigatiemenu" className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[min(300px,88vw)] flex-col overflow-hidden border-r-[0.5px] border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_72%,var(--card)_28%)] text-[var(--foreground)] shadow-2xl md:hidden">
            <div className="flex shrink-0 items-center justify-between border-b-[0.5px] border-[var(--border)] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Menu
              </span>
              <button
                ref={menuCloseRef}
                type="button"
                className="min-h-11 rounded-md px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                onClick={() => closeMobileMenu()}
              >
                Sluiten
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-6">
              <SidebarContent
                studentName={studentName}
                accessLevel={accessLevel}
                unreadNotificationCount={unreadNotificationCount}
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
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
            onClick={openMobileMenu}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <NavigationIcon name="menu" />
            Menu
          </button>
          <Link href="/dashboard" className="inline-flex items-center">
            <BrandLogo
              logoClassName="h-auto w-[150px] min-[390px]:w-[166px]"
            />
          </Link>
          <ThemeToggle />
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <PageLoadOverlay>{children}</PageLoadOverlay>
          </div>
        </main>
      </div>

      {showFloatingNotifications && (
        <NotificationPopover
          notifications={floatingNotifications}
          unreadCount={unreadNotificationCount}
        />
      )}
    </div>
  );
}
