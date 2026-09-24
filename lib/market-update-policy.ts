import type { WeeklyUpdateContentFormat } from "@/lib/types";

export function validateMarketUpdatePublication(input: {
  contentFormat: WeeklyUpdateContentFormat;
  body: string | null;
  imagePaths: string[];
  muxReady: boolean;
}): string | null {
  if (input.contentFormat === "video") {
    return input.muxReady ? null : "Upload en sync eerst een Mux-video voordat je publiceert.";
  }
  if (!input.body || input.body.trim().length < 20) {
    return "Schrijf minimaal 20 tekens duiding voor publicatie.";
  }
  if (input.contentFormat === "chart" && input.imagePaths.length === 0) {
    return "Upload minimaal één chart voor publicatie.";
  }
  return null;
}
