"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui/Brand";

/** Logo opacity fade: 50% → 100% over this duration (ms), then exit sequence. */
const LOGO_FADE_MS = 550;

interface LoadingOverlayProps {
  onComplete?: () => void;
  children?: React.ReactNode;
}

export function LoadingOverlay({ onComplete, children }: LoadingOverlayProps) {
  const [logoOpacity, setLogoOpacity] = useState(0.5);
  const [isClipping, setIsClipping] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const startTime = Date.now();

    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / LOGO_FADE_MS, 1);
      const eased = easeOutCubic(t);
      // 0.5 → 1
      setLogoOpacity(0.5 + eased * 0.5);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setLogoOpacity(1);
        setTimeout(() => {
          setIsClipping(true);

          setTimeout(() => {
            setShowContent(true);
            onComplete?.();
          }, 400);
        }, 100);
      }
    };

    requestAnimationFrame(tick);
  }, [onComplete]);

  return (
    <>
      <div
        className="fixed inset-0 z-[45] flex items-center justify-center bg-[var(--background)] transition-[clip-path] duration-[400ms] ease-in-out"
        style={{
          clipPath: isClipping ? "inset(0 0 100% 0)" : "inset(0 0 0% 0)",
          pointerEvents: isClipping ? "none" : "auto",
        }}
        aria-hidden={isClipping}
      >
        <BrandLogo
          className="max-w-[min(70vw,320px)] select-none"
          iconClassName="h-9 w-9"
          textClassName="text-xs sm:text-sm"
          style={{ opacity: logoOpacity }}
        />
      </div>

      <div
        className="transition-[opacity,transform] duration-[600ms] ease-out"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(100px)",
        }}
      >
        {children}
      </div>
    </>
  );
}
