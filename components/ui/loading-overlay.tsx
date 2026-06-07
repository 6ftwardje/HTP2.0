"use client";

import type React from "react";
import { useEffect } from "react";

interface LoadingOverlayProps {
  onComplete?: () => void;
  children?: React.ReactNode;
}

export function LoadingOverlay({ onComplete, children }: LoadingOverlayProps) {
  useEffect(() => {
    onComplete?.();
  }, [onComplete]);

  return <>{children}</>;
}
