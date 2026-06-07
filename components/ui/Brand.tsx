import Image from "next/image";
import type { CSSProperties } from "react";

export const BRAND = {
  name: "Het Trade Platform",
  logoIconSrc: "/assets/brand/logo-icon.png",
  logoWithTextSrc: "/assets/brand/logo-text.png",
  supportEmail: "info@hettradeplatform.be",
} as const;

export function BrandLogo({
  className = "",
  iconClassName = "h-9 w-9",
  textClassName = "text-sm",
  style,
}: {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} style={style}>
      <Image
        src={BRAND.logoIconSrc}
        alt=""
        width={48}
        height={48}
        className={`shrink-0 ${iconClassName}`}
        priority
      />
      <span
        className={`font-extrabold uppercase tracking-[0.08em] text-[var(--foreground)] ${textClassName}`}
      >
        {BRAND.name}
      </span>
    </div>
  );
}
