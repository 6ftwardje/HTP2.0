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
      className={`rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 ${className}`}
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
