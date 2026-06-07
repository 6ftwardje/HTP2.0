import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Nav row: matches premium members UI — light mode solid active bar,
 * dark mode subtle white/5 + light text (same idea as pre-redesign AppShell).
 */
export function SidebarNavItem({
  href,
  label,
  active,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-tight transition-colors",
        active
          ? [
              "bg-stone-900 text-white shadow-sm",
              "dark:bg-white/10 dark:text-stone-50 dark:shadow-none dark:ring-1 dark:ring-white/10",
            ].join(" ")
          : [
              "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
              "dark:text-stone-300 dark:hover:bg-white/5 dark:hover:text-stone-50",
            ].join(" "),
      ].join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
          active
            ? "border-white/15 bg-white/10 text-white dark:border-white/20 dark:bg-white/10 dark:text-stone-50"
            : [
                "border-stone-200/80 bg-white text-stone-500",
                "group-hover:border-stone-300 group-hover:text-stone-900",
                "dark:border-stone-600 dark:bg-stone-900/40 dark:text-stone-400",
                "dark:group-hover:border-stone-500 dark:group-hover:bg-white/5 dark:group-hover:text-stone-50",
              ].join(" "),
        ].join(" ")}
        aria-hidden
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
