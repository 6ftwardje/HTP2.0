import type { ReactNode } from "react";

/**
 * Desktop: primary column + optional right rail. Mobile/tablet: stacks (rail below main).
 */
export function AppPageLayout({
  main,
  rail,
  railClassName = "",
}: {
  main: ReactNode;
  rail?: ReactNode;
  railClassName?: string;
}) {
  if (!rail) {
    return <div className="min-w-0">{main}</div>;
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:gap-12 xl:gap-14">
      <div className="min-w-0 space-y-10">{main}</div>
      <aside
        className={`min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start ${railClassName}`}
      >
        {rail}
      </aside>
    </div>
  );
}
