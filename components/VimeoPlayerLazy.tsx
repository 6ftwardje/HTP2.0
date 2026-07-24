"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";

const VimeoPlayerCore = dynamic(
  () =>
    import("@/components/VimeoPlayerCore").then((module) => module.VimeoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-stone-950">
        <span className="text-sm font-semibold text-white/70">
          Video laden...
        </span>
      </div>
    ),
  }
);

type Props = {
  videoUrl: string | null;
  videoProvider?: string;
  muxPlaybackId?: string | null;
  muxPlaybackPolicy?: "public" | "signed";
  title?: string;
  onEnded?: (() => void) | null;
};

function muxPosterUrl(playbackId?: string | null) {
  const id = playbackId?.trim();
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return `https://image.mux.com/${id}/thumbnail.webp?width=1280`;
}

export function VimeoPlayer(props: Props) {
  const [activated, setActivated] = useState(false);

  if (activated) {
    return <VimeoPlayerCore {...props} />;
  }

  const poster =
    props.videoProvider === "mux" ? muxPosterUrl(props.muxPlaybackId) : null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[color-mix(in_oklab,#f50101_34%,var(--border)_66%)] bg-stone-950">
      {poster ? (
        <Image
          src={poster}
          alt=""
          fill
          sizes="(min-width: 1024px) 70vw, 100vw"
          className="object-cover opacity-75"
          priority
        />
      ) : null}
      <div className="absolute inset-0 bg-black/30" />
      <button
        type="button"
        onClick={() => setActivated(true)}
        className="absolute inset-0 flex w-full items-center justify-center text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        aria-label={`${props.title ?? "Video"} afspelen`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-black/45 backdrop-blur-sm">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
          </svg>
        </span>
      </button>
    </div>
  );
}
