"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import { PageLoadOverlay } from "@/components/PageLoadOverlay";
import { PlatformTopbar } from "@/components/PlatformTopbar";
import { BrandLogo } from "@/components/ui/Brand";
import { useMobileDrawer } from "@/components/useMobileDrawer";
import type { FloatingNotification } from "@/components/ui/notification-popover";
import { useNotificationsRealtime } from "@/lib/realtime-hooks";
import { AccountMenu } from "@/components/AccountMenu";

const adminNav = [
  {
    href: "/admin",
    label: "Overzicht",
    icon: <NavigationIcon name="dashboard" />,
  },
  {
    href: "/admin/product-board",
    label: "Productbord",
    icon: <NavigationIcon name="dashboard" />,
  },
  {
    href: "/admin/students",
    label: "Studenten",
    icon: <NavigationIcon name="students" />,
  },
  {
    href: "/mentor-inbox",
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
  { href: "/admin/documents", label: "PDF-beheer", icon: <NavigationIcon name="lessons" /> },
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
  studentId,
  avatarPath,
  isChatMentor,
  onNavigate,
}: {
  studentName: string | null;
  studentId?: string | null;
  avatarPath?: string | null;
  isChatMentor: boolean;
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

      <nav
        className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
        aria-label="Beheermenu"
      >
        {adminNav.filter((item) => item.href !== "/mentor-inbox" || isChatMentor).map((item) => {
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
        <AccountMenu name={studentName} studentId={studentId} avatarPath={avatarPath} accessLevel={3} onNavigate={onNavigate}/>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  studentName,
  studentId = null,
  avatarPath = null,
  isChatMentor = false,
  floatingNotifications = [],
  unreadNotificationCount = 0,
  notificationError = null,
}: {
  children: React.ReactNode;
  studentName: string | null;
  isChatMentor?: boolean;
  floatingNotifications?: FloatingNotification[];
  unreadNotificationCount?: number;
  notificationError?: string | null;
  studentId?: string | null;
  avatarPath?: string | null;
}) {
  const { mobileOpen, menuTriggerRef, menuCloseRef, menuPanelRef, openMobileMenu, closeMobileMenu } = useMobileDrawer();
  const pathname = usePathname();
  useNotificationsRealtime(studentId);
  const isWideWorkspace = pathname.startsWith("/admin/videos") || pathname.startsWith("/admin/product-board");

  return (
    <div className="platform-surface flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <aside className="relative hidden h-full min-h-0 w-[272px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_72%,var(--card)_28%)] md:flex">
        <div className="flex h-full min-h-0 flex-col px-5 py-7">
          <SidebarContent
            studentName={studentName}
            studentId={studentId}
            avatarPath={avatarPath}
            isChatMentor={isChatMentor}
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
                studentId={studentId}
                avatarPath={avatarPath}
                isChatMentor={isChatMentor}
                onNavigate={() => closeMobileMenu(false)}
              />
            </div>
          </aside>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformTopbar menuTriggerRef={menuTriggerRef} mobileOpen={mobileOpen} openMobileMenu={openMobileMenu}
          menuId="admin-mobile-nav" admin floatingNotifications={floatingNotifications} unreadNotificationCount={unreadNotificationCount} notificationError={notificationError}/>
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
