import type { CSSProperties, ReactNode } from "react";
import styles from "./MarketTag.module.css";

export const MARKET_TAG_LABELS = {
  crypto: "Crypto",
  forex: "Forex",
  stocks: "Aandelen",
  gold: "Goud",
  commodities: "Commodities",
  trading: "Trading",
} as const;

export type MarketTagMarket = keyof typeof MARKET_TAG_LABELS;

/** Presentation only. Legacy Macro, Indices and Algemeen keep their own labels. */
export function marketTagMarket(value: string): MarketTagMarket | null {
  const label = value.toLocaleLowerCase("nl-BE");
  if (label === "grondstoffen") return "commodities";
  return (Object.keys(MARKET_TAG_LABELS) as MarketTagMarket[]).find(
    (key) => key === label || MARKET_TAG_LABELS[key].toLocaleLowerCase("nl-BE") === label,
  ) ?? null;
}

export function MarketTag({ market, children, className = "" }: {
  market: MarketTagMarket;
  children?: ReactNode;
  className?: string;
}) {
  const style = {
    "--market-color": `var(--market-${market})`,
    "--market-ink": `var(--market-${market}-text)`,
  } as CSSProperties;
  return <span data-market={market} style={style} className={`${styles.tag} ${className}`}>
    {children ?? MARKET_TAG_LABELS[market]}
  </span>;
}
