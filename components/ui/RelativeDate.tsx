"use client";

import { useEffect, useId, useState } from "react";
import { relativeDate } from "@/lib/relative-date";

export function RelativeDate({ value, className = "", focusable = true }: {
  value: string;
  className?: string;
  /** Dates inside a card link/button use the parent focus, avoiding extra stops. */
  focusable?: boolean;
}) {
  const id = useId();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [value]);
  const date = relativeDate(value, now);
  return <time dateTime={date.dateTime} title={date.exact} aria-describedby={id}
    tabIndex={focusable ? 0 : undefined} className={`cb-relative-date ${className}`} suppressHydrationWarning>
    <span suppressHydrationWarning>{date.label}</span>
    <span id={id} role="tooltip" className="cb-date-tooltip">{date.exact}</span>
  </time>;
}
