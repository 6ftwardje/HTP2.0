import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./Brand.module.css";

export const BRAND = {
  name: "Het Trade Platform",
  logoIconSrc: "/assets/brand/logo-icon.png",
  logoWithTextSrc: "/assets/brand/logo-text.png",
  logoWithTextLightSrc:
    "https://trogwrgxxhsvixzglzpn.supabase.co/storage/v1/object/public/HTP/The%20Trade%20Platform.webp",
  supportEmail: "info@hettradeplatform.be",
} as const;

export function BrandLogo({
  className = "",
  iconClassName = "h-9 w-9",
  logoClassName = "h-auto w-[172px]",
  variant = "full",
  priority = true,
  style,
  tone = "theme",
}: {
  className?: string;
  iconClassName?: string;
  logoClassName?: string;
  variant?: "full" | "icon";
  priority?: boolean;
  style?: CSSProperties;
  tone?: "theme" | "on-dark";
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
    <span role="img" aria-label={BRAND.name} style={style}
      className={`${styles.logo} ${tone === "on-dark" ? styles.onDark : ""} ${logoClassName} ${className}`}>
      <span className={styles.wordmark} aria-hidden="true">
        <span className={styles.mark}>
          <Image src={BRAND.logoIconSrc} alt="" width={3000} height={3000} priority={priority} sizes="160px" />
        </span>
        <span className={styles.text}><small>HET</small><strong>TRADE</strong>PLATFORM</span>
      </span>
    </span>
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
