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
        "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold tracking-tight transition-colors",
        active
          ? [
              "bg-[var(--surface-hover)] text-[var(--foreground)]",
              "before:absolute before:-left-5 before:top-0 before:h-full before:w-[3px] before:bg-[var(--accent)]",
            ].join(" ")
          : [
              "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
            ].join(" "),
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          active
            ? "text-[var(--accent)]"
            : "text-[var(--muted)] group-hover:text-[var(--foreground)]",
        ].join(" ")}
        aria-hidden
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
