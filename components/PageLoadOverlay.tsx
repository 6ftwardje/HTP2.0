"use client";

import type { ReactNode } from "react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

/**
 * Wraps page content with the loading percentage + clip reveal.
 * The overlay stays mounted so internal route changes do not replay the sequence.
 */
export function PageLoadOverlay({ children }: { children: ReactNode }) {
  return <LoadingOverlay>{children}</LoadingOverlay>;
}
