import type { ReactNode } from "react";

export function RightRailCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_1px_0_rgba(28,25,23,0.04)] sm:p-6 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)] ${className}`}
    >
      {title ? (
        <>
          <div className="cb-eyebrow">{title}</div>
          <div className="mt-4">{children}</div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
