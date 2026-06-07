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
  logoClassName = "h-auto w-[172px]",
  variant = "full",
  priority = true,
  style,
}: {
  className?: string;
  iconClassName?: string;
  logoClassName?: string;
  variant?: "full" | "icon";
  priority?: boolean;
  style?: CSSProperties;
}) {
  if (variant === "icon") {
    return (
      <Image
        src={BRAND.logoIconSrc}
        alt={BRAND.name}
        width={3000}
        height={3000}
        className={`block shrink-0 ${iconClassName} ${className}`}
        priority={priority}
        style={style}
      />
    );
  }

  return (
    <Image
      src={BRAND.logoWithTextSrc}
      alt={BRAND.name}
      width={1855}
      height={315}
      className={`block shrink-0 ${logoClassName} ${className}`}
      priority={priority}
      style={style}
    />
  );
}

export function BrandIcon({
  className = "h-9 w-9",
  priority = false,
  decorative = true,
}: {
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  return (
    <Image
      src={BRAND.logoIconSrc}
      alt={decorative ? "" : BRAND.name}
      width={3000}
      height={3000}
      className={`block shrink-0 ${className}`}
      priority={priority}
    />
  );
}
