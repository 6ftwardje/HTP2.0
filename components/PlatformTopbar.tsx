"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { BrandLogo } from "@/components/ui/Brand";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPopover, type FloatingNotification } from "@/components/ui/notification-popover";

export function PlatformTopbar({ menuTriggerRef, mobileOpen, openMobileMenu, menuId, admin = false,
  floatingNotifications, unreadNotificationCount, notificationError }: {
  menuTriggerRef: RefObject<HTMLButtonElement>; mobileOpen: boolean; openMobileMenu: () => void;
  menuId: string; admin?: boolean; floatingNotifications: FloatingNotification[];
  unreadNotificationCount: number; notificationError?: string | null;
}) {
  return <header className="platform-topbar">
    <button ref={menuTriggerRef} type="button" className="platform-toolbar-control md:!hidden"
      onClick={openMobileMenu} aria-label="Menu openen" aria-expanded={mobileOpen} aria-controls={menuId}>
      <NavigationIcon name="menu"/>
    </button>
    <Link href={admin?"/admin":"/dashboard"} className="mr-auto inline-flex min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] md:hidden" aria-label={admin?"Beheeroverzicht":"Dashboard"}>
      {admin?<span className="text-sm font-semibold">Beheer</span>:<BrandLogo logoClassName="h-auto w-[136px]"/>}
    </Link>
    <div className="ml-auto flex shrink-0 items-center gap-2" aria-label="Platformbediening">
      <NotificationPopover notifications={floatingNotifications} unreadCount={unreadNotificationCount} loadError={notificationError}/>
      <ThemeToggle className="platform-toolbar-control"/>
    </div>
  </header>;
}
