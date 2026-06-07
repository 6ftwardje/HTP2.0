"use client";

import Image from "next/image";
import { useState } from "react";

type CourseThumbnailProps = {
  src?: string | null;
  title: string;
  eyebrow?: string;
  className?: string;
  imageClassName?: string;
  muted?: boolean;
  moduleNumber?: number | string;
  showTitleOverlay?: boolean;
  priority?: boolean;
  sizes?: string;
};

export function CourseThumbnail({
  src,
  title,
  eyebrow,
  className = "",
  imageClassName = "",
  muted = false,
  moduleNumber,
  showTitleOverlay = false,
  priority = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: CourseThumbnailProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const initial = title.trim().charAt(0).toUpperCase() || "C";
  const hasImage = Boolean(src);
  const imageLoaded = hasImage && loadedSrc === src;
  const shouldShowModuleOverlay = moduleNumber !== undefined && moduleNumber !== null;

  return (
    <div
      className={`group/thumbnail relative isolate min-w-0 max-w-full overflow-hidden bg-[color-mix(in_oklab,var(--card)_82%,var(--border)_18%)] ${className}`}
    >
      {hasImage ? (
        <>
          {!imageLoaded ? (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--card)_82%,var(--background)_18%)]" />
              <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(110deg,transparent_0%,color-mix(in_oklab,var(--foreground)_8%,transparent)_38%,transparent_72%)] [background-size:220%_100%] animate-[thumbnail-shimmer_1.4s_ease-in-out_infinite]" />
            </div>
          ) : null}
          <Image
            src={src as string}
            alt=""
            fill
            priority={priority}
            onLoad={() => setLoadedSrc(src ?? null)}
            className={[
              "object-cover transition-[opacity,filter,transform] duration-700 ease-out",
              imageLoaded ? "opacity-100" : "opacity-0",
              muted ? "grayscale brightness-75" : "",
              shouldShowModuleOverlay
                ? "group-hover/thumbnail:scale-[1.045] group-hover/thumbnail:blur-[3px] group-hover/thumbnail:brightness-75"
                : "",
              imageClassName,
            ].join(" ")}
            sizes={sizes}
          />
        </>
      ) : (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)]" />
          <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_7%,transparent)_1px,transparent_1px),linear-gradient(180deg,color-mix(in_oklab,var(--foreground)_7%,transparent)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-xl font-black text-[var(--foreground)]">
            {initial}
          </div>
        </div>
      )}

      {hasImage && imageLoaded ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-950/72 via-stone-950/12 to-stone-950/8 opacity-90 transition-opacity duration-500 group-hover/thumbnail:opacity-100" />
      ) : null}

      {eyebrow && (!hasImage || imageLoaded) ? (
        <div className="absolute left-3 top-3 rounded-md border border-white/20 bg-stone-950/54 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
          {eyebrow}
        </div>
      ) : null}

      {showTitleOverlay && (!hasImage || imageLoaded) ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h3 className="max-w-[92%] text-balance text-lg font-extrabold leading-tight text-white drop-shadow-sm sm:text-xl">
            {title}
          </h3>
        </div>
      ) : null}

      {shouldShowModuleOverlay && imageLoaded ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover/thumbnail:opacity-100">
          <div className="text-[clamp(4.5rem,18vw,9rem)] font-black leading-none text-white/88 drop-shadow-xl">
            {moduleNumber}
          </div>
        </div>
      ) : null}
    </div>
  );
}
