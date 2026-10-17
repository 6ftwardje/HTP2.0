"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import { PageLoadOverlay } from "@/components/PageLoadOverlay";
import { PlatformTopbar } from "@/components/PlatformTopbar";
import { BrandLogo } from "@/components/ui/Brand";
import {
  type FloatingNotification,
} from "@/components/ui/notification-popover";

import { useNotificationsRealtime } from "@/lib/realtime-hooks";
import { useMobileDrawer } from "@/components/useMobileDrawer";
import { AccountMenu } from "@/components/AccountMenu";

const coreNav = [
  { href: "/dashboard", label: "Dashboard", icon: <NavigationIcon name="dashboard" /> },
  { href: "/modules", label: "Academy", icon: <NavigationIcon name="academy" /> },
  { href: "/mentor", label: "Mentorchat", icon: <NavigationIcon name="mentor" /> },
];
const marketNav = [
  { href: "/market-analysis", label: "Marktinzicht", icon: <NavigationIcon name="market" /> },
  { href: "/live-sessions", label: "Live marktsessies", icon: <NavigationIcon name="live" /> },
];
function SidebarContent({ studentName, studentId, avatarPath, accessLevel, hasSubscriberAccess, isChatMentor, unreadChatCount, onNavigate }: {
  studentName: string | null; studentId?: string | null; avatarPath?: string | null;
  accessLevel: number | null; hasSubscriberAccess: boolean; isChatMentor: boolean; unreadChatCount: number; onNavigate?: () => void;
}) {
  const pathname=usePathname();
  function render(item: typeof coreNav[number]) {
    const href=item.href==="/mentor"&&isChatMentor?"/mentor-inbox":item.href;
    const active=pathname===href || pathname.startsWith(href+"/") || (href==="/market-analysis"&&pathname.startsWith("/updates"));
    const label=item.href==="/mentor" ? (isChatMentor?"Studentvragen":"Mentorchat")+(unreadChatCount>0?" ("+Math.min(unreadChatCount,99)+")":"") : item.label;
    return <SidebarNavItem key={href} href={href} label={label} icon={item.icon} active={active} onNavigate={onNavigate}/>;
  }
  return <div className="flex h-full min-h-0 flex-col">
    <Link href="/dashboard" onClick={onNavigate} className="mx-1 inline-flex self-start rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"><BrandLogo logoClassName="h-auto w-[176px]"/></Link>
    <nav aria-label="Hoofdnavigatie" className="mb-6 mt-9 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
      {coreNav.map(render)}
      {accessLevel!==null && <><div className="mb-1 mt-6 px-3 text-xs font-semibold text-[var(--muted)]">Markt</div>{marketNav.filter(item=>item.href==="/market-analysis"||hasSubscriberAccess).map(render)}</>}
    </nav>
    <AccountMenu name={studentName} studentId={studentId} avatarPath={avatarPath} accessLevel={accessLevel} onNavigate={onNavigate}/>
  </div>;
}

export function AppShell({
  children,
  studentName,
  accessLevel,
  avatarPath = null,
  hasSubscriberAccess = accessLevel !== null && accessLevel >= 2,
  currentStudentId = null,
  unreadNotificationCount = 0,
  notificationError = null,
  floatingNotifications = [],
  isChatMentor = false,
  unreadChatCount = 0,
}: {
  children: React.ReactNode;
  studentName: string | null;
  accessLevel: number | null;
  currentStudentId?: string | null;
  avatarPath?: string | null;
  hasSubscriberAccess?: boolean;
  unreadNotificationCount?: number;
  notificationError?: string | null;
  floatingNotifications?: FloatingNotification[];
  isChatMentor?: boolean;
  unreadChatCount?: number;
}) {
  const { mobileOpen, menuTriggerRef, menuCloseRef, menuPanelRef, openMobileMenu, closeMobileMenu } = useMobileDrawer();
  const pathname = usePathname();
  const isChatWorkspace = pathname === "/mentor" || pathname === "/mentor-inbox";

  useNotificationsRealtime(currentStudentId);

  return (
    <div className="platform-surface flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Desktop sidebar: vaste viewporthoogte; alleen main rechts scrollt */}
      <aside className="relative hidden h-full min-h-0 w-[252px] shrink-0 flex-col overflow-hidden border-r-[0.5px] border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_72%,var(--card)_28%)] text-[var(--foreground)] md:flex">
        <div className="flex h-full min-h-0 flex-col px-5 py-8">
          <SidebarContent
            studentName={studentName}
            studentId={currentStudentId}
            avatarPath={avatarPath}
            accessLevel={accessLevel}
            hasSubscriberAccess={hasSubscriberAccess}
            isChatMentor={isChatMentor}
            unreadChatCount={unreadChatCount}
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
                studentId={currentStudentId}
                avatarPath={avatarPath}
                accessLevel={accessLevel}
                hasSubscriberAccess={hasSubscriberAccess}
                isChatMentor={isChatMentor}
                unreadChatCount={unreadChatCount}
                onNavigate={() => closeMobileMenu(false)}
              />
            </div>
          </aside>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformTopbar menuTriggerRef={menuTriggerRef} mobileOpen={mobileOpen} openMobileMenu={openMobileMenu}
          menuId="mobile-nav" floatingNotifications={floatingNotifications} unreadNotificationCount={unreadNotificationCount} notificationError={notificationError}/>
        <main className={isChatWorkspace ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto overscroll-contain"}>
          <div className={isChatWorkspace ? "h-full min-h-0 w-full" : "mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"}>
            <PageLoadOverlay>{children}</PageLoadOverlay>
          </div>
        </main>
      </div>


    </div>
  );
}
