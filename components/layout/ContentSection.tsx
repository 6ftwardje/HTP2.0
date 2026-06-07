import type { ReactNode } from "react";

export function ContentSection({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-5 ${className}`}>
      {(eyebrow || title || description) && (
        <div className="space-y-2">
          {eyebrow && <div className="cb-eyebrow">{eyebrow}</div>}
          {title && <h2 className="cb-section-title">{title}</h2>}
          {description && (
            <p className="cb-caption max-w-2xl">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
