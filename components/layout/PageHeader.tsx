import type { ReactNode } from "react";
import type { BreadcrumbItem } from "./Breadcrumbs";
import { Breadcrumbs } from "./Breadcrumbs";

export function PageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  breadcrumbs?: BreadcrumbItem[];
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-8 sm:mb-10 lg:mb-12">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-5">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0 space-y-3">
          {eyebrow && <p className="cb-eyebrow">{eyebrow}</p>}
          <h1 className="cb-page-title">{title}</h1>
          {description && <p className="cb-body max-w-2xl">{description}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          {meta && (
            <div className="cb-caption text-right sm:text-right">{meta}</div>
          )}
          {actions && (
            <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
          )}
        </div>
      </div>
    </header>
  );
}
