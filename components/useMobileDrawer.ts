"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useMobileDrawer() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(false);

  const openMobileMenu = useCallback(() => {
    restoreFocusRef.current = true;
    setMobileOpen(true);
  }, []);

  const closeMobileMenu = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        menuPanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !menuPanelRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !menuPanelRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMobileMenu, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = menuTriggerRef.current;
    menuCloseRef.current?.focus();
    return () => {
      if (restoreFocusRef.current) trigger?.focus();
      restoreFocusRef.current = false;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return { mobileOpen, menuTriggerRef, menuCloseRef, menuPanelRef, openMobileMenu, closeMobileMenu };
}
