import type { Market, MarketAnalysisType } from "@/lib/types";

export const MARKET_OPTIONS: Array<{ value: Market; label: string }> = [
  { value: "stocks", label: "Stocks" },
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
];

export const MARKET_ANALYSIS_TYPE_OPTIONS: Array<{
  value: Exclude<MarketAnalysisType, "live_session">;
  label: string;
}> = [
  { value: "weekly_outlook", label: "Weekly outlook" },
  { value: "market_update", label: "Markt update" },
];

export function getMarketLabel(market: Market | null): string {
  return MARKET_OPTIONS.find((option) => option.value === market)?.label ?? "—";
}

export function getMarketAnalysisTypeLabel(
  type: MarketAnalysisType | null
): string {
  if (type === "weekly_outlook") return "Weekly outlook";
  if (type === "market_update") return "Markt update";
  if (type === "live_session") return "Live sessie";
  return "Niet gecategoriseerd";
}

export function getMondayDate(value = new Date()): string {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getIsoWeekNumber(value: string | Date): number {
  const source = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  const date = new Date(Date.UTC(source.getFullYear(), source.getMonth(), source.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
