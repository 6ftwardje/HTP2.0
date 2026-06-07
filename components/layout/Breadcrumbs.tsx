import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span className="select-none opacity-40 text-[var(--muted)]" aria-hidden>
              /
            </span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--foreground)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
