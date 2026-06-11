"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MIN_VISIBLE_MS = 320;
const SHOW_DELAY_MS = 80;
const MAX_VISIBLE_MS = 12000;
const USER_INITIATED_REQUEST_MS = 1500;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isSameDocumentHashLink(url: URL) {
  return (
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash !== window.location.hash
  );
}

function shouldStartForLink(anchor: HTMLAnchorElement) {
  const target = anchor.getAttribute("target");
  const href = anchor.getAttribute("href");

  if (!href || href.startsWith("#") || anchor.hasAttribute("download")) {
    return false;
  }

  if (target && target !== "_self") {
    return false;
  }

  const url = new URL(href, window.location.href);

  if (url.origin !== window.location.origin) {
    return false;
  }

  return !isSameDocumentHashLink(url);
}

export function TopLoadingBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const visibleRef = useRef(false);
  const activeRequests = useRef(0);
  const lastUserIntentAt = useRef(0);
  const visibleSince = useRef(0);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);

  const clearTimer = (timer: typeof showTimer) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const setBarVisible = useCallback((nextVisible: boolean) => {
    visibleRef.current = nextVisible;
    setVisible(nextVisible);
  }, []);

  const finish = useCallback(() => {
    clearTimer(showTimer);

    const elapsed = Date.now() - visibleSince.current;
    const delay = visibleRef.current ? Math.max(MIN_VISIBLE_MS - elapsed, 0) : 0;

    clearTimer(hideTimer);
    hideTimer.current = window.setTimeout(() => {
      setFinishing(true);
      hideTimer.current = window.setTimeout(() => {
        setBarVisible(false);
        setFinishing(false);
        clearTimer(maxTimer);
      }, 220);
    }, delay);
  }, [setBarVisible]);

  const start = useCallback(() => {
    clearTimer(hideTimer);
    setFinishing(false);

    if (!showTimer.current && !visibleRef.current) {
      showTimer.current = window.setTimeout(() => {
        showTimer.current = null;
        visibleSince.current = Date.now();
        setBarVisible(true);
      }, SHOW_DELAY_MS);
    }

    clearTimer(maxTimer);
    maxTimer.current = window.setTimeout(() => {
      activeRequests.current = 0;
      finish();
    }, MAX_VISIBLE_MS);
  }, [finish, setBarVisible]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a");
      const button = target?.closest("button");

      if (anchor || button) {
        lastUserIntentAt.current = Date.now();
      }

      if (anchor instanceof HTMLAnchorElement && shouldStartForLink(anchor)) {
        start();
      }
    };

    const onSubmit = (event: SubmitEvent) => {
      if (!event.defaultPrevented) {
        lastUserIntentAt.current = Date.now();
        start();
      }
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener("submit", onSubmit, true);
    window.addEventListener("beforeunload", start);

    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("beforeunload", start);
    };
  }, [start]);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const isUserInitiated =
        visibleRef.current ||
        showTimer.current !== null ||
        Date.now() - lastUserIntentAt.current < USER_INITIATED_REQUEST_MS;

      if (!isUserInitiated) {
        return originalFetch(...args);
      }

      activeRequests.current += 1;
      start();

      try {
        return await originalFetch(...args);
      } finally {
        activeRequests.current -= 1;

        if (activeRequests.current <= 0) {
          activeRequests.current = 0;
          finish();
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [finish, start]);

  useEffect(() => {
    finish();
  }, [finish, pathname]);

  return (
    <div
      className={[
        "top-loading-bar",
        visible ? "top-loading-bar--visible" : "",
        finishing ? "top-loading-bar--finishing" : "",
      ].join(" ")}
      role="progressbar"
      aria-hidden={!visible}
      aria-label="Pagina laadt"
    />
  );
}
