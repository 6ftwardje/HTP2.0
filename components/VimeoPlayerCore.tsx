"use client";

import dynamic from "next/dynamic";
import { extractVimeoId, getVimeoEmbedUrl } from "@/lib/vimeo";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MuxPlaybackTokens } from "@/lib/types";
import type { VideoSeekRequest } from "@/lib/video-seek";

const MuxLessonPlayer = dynamic(
  () => import("@/components/MuxLessonPlayer").then((mod) => mod.MuxLessonPlayer),
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
  muxTokens?: MuxPlaybackTokens | null;
  seekRequest?: VideoSeekRequest | null;
  enableSeeking?: boolean;
  surface?: "lesson" | "insight";
};

function extractMuxPlaybackId(
  videoUrl: string | null,
  muxPlaybackId?: string | null
): string | null {
  if (muxPlaybackId?.trim()) return muxPlaybackId.trim();
  if (!videoUrl) return null;

  const trimmed = videoUrl.trim();
  if (!trimmed) return null;

  const streamUrl = /stream\.mux\.com\/([^/?#]+)\.m3u8/i.exec(trimmed);
  if (streamUrl?.[1]) return streamUrl[1];

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export function VimeoPlayer({
  videoUrl,
  videoProvider = "vimeo",
  muxPlaybackId,
  muxPlaybackPolicy = "public",
  title,
  onEnded = null,
  muxTokens = null,
  seekRequest = null,
  enableSeeking = false,
  surface = "lesson",
}: Props) {
  const [providerError, setProviderError] = useState(false);
  const [loading, setLoading] = useState(true);
  const muxId =
    videoProvider === "mux" ? extractMuxPlaybackId(videoUrl, muxPlaybackId) : null;
  const canUseVimeo =
    videoProvider === "vimeo" && videoUrl && videoUrl.trim().length > 0;
  const videoId = canUseVimeo ? extractVimeoId(videoUrl) : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const latestSeekRef = useRef<VideoSeekRequest | null>(seekRequest);
  latestSeekRef.current = seekRequest;
  const shouldListen = (!!onEnded || enableSeeking) && !!videoId;
  const frameClass = surface === "insight" ? "relative aspect-video w-full overflow-hidden rounded-md bg-stone-950" : "relative aspect-video w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-950";
  useEffect(() => { setProviderError(false); setLoading(true); }, [videoUrl, muxPlaybackId]);

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    let url = getVimeoEmbedUrl(videoId);
    // Enable Vimeo Player API when we need to listen to events.
    if (onEnded) {
      url += url.includes("?") ? "&" : "?";
      url += "api=1";
    }
    return url;
  }, [videoId, onEnded]);

  useEffect(() => {
    if (!shouldListen) return;
    const iframeEl = iframeRef.current;
    if (!iframeEl) return;

    let player: any = null;
    let cancelled = false;
    const onProviderError = () => { if (!cancelled) setProviderError(true); };

    async function loadAndBind() {
      const w = window as any;
      if (!w.Vimeo?.Player) {
        const scriptId = "vimeo-player-api";
        const existing = document.getElementById(scriptId);
        if (!existing) {
          const script = document.createElement("script");
          script.id = scriptId;
          script.src = "https://player.vimeo.com/api/player.js";
          script.async = true;
          document.body.appendChild(script);
          await new Promise<void>((resolve) => {
            script.addEventListener("load", () => resolve(), { once: true });
            script.addEventListener("error", () => { script.dataset.failed = "true"; resolve(); }, { once: true });
          });
        } else if (existing.dataset.failed) {
          setProviderError(true); return;
        } else if (!w.Vimeo?.Player) {
          await new Promise<void>((resolve) => {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => resolve(), { once: true });
          });
        }
      }
      if (cancelled) return;
      const Player = (window as any).Vimeo?.Player;
      if (!Player) { setProviderError(true); return; }
      player = new Player(iframeEl);
      player.on("error", onProviderError);
      await player.ready();
      if (cancelled) return;
      setLoading(false);
      vimeoPlayerRef.current = player;
      if (onEnded) player.on("ended", onEnded);
      if (latestSeekRef.current) {
        await player.setCurrentTime(latestSeekRef.current.seconds);
        await player.play().catch(() => undefined);
      }
    }

    void loadAndBind().catch(() => { if (!cancelled) setProviderError(true); });

    return () => {
      cancelled = true;
      if (player) {
        try {
          player.off("ended", onEnded);
          player.off("error", onProviderError);
          // destroy removes the iframe. React owns it; Strict Mode/HMR and
          // callback changes can reuse it. Destroy only after actual removal.
          const retiring = player;
          queueMicrotask(() => {
            if (!iframeEl.isConnected) void retiring.destroy().catch(() => undefined);
          });
        } catch {
          // ignore teardown errors
        }
      }
      vimeoPlayerRef.current = null;
    };
  }, [onEnded, shouldListen, videoId]);

  useEffect(() => {
    if (!seekRequest || !vimeoPlayerRef.current) return;
    void vimeoPlayerRef.current
      .setCurrentTime(seekRequest.seconds)
      .then(() => vimeoPlayerRef.current?.play())
      .catch(() => undefined);
  }, [seekRequest]);

  if (muxId && (muxPlaybackPolicy === "public" || muxTokens?.playback)) {
    return (
      <div className={frameClass}>
        <MuxLessonPlayer
          playbackId={muxId}
          title={title}
          onEnded={onEnded}
          tokens={muxTokens}
          seekRequest={seekRequest}
          accentColor={surface === "insight" ? "#9a8cff" : undefined}
          onError={() => setProviderError(true)}
        />
        {providerError ? <p role="alert" className="absolute inset-x-0 top-0 bg-stone-950/95 p-4 text-center text-sm text-white">De videoprovider kon deze video niet laden. Controleer je verbinding en vernieuw de pagina.</p> : null}
      </div>
    );
  }

  if (muxId && muxPlaybackPolicy === "signed") {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-stone-950 px-6 text-center text-sm font-semibold text-white/70">
        De beveiligde video is tijdelijk niet beschikbaar. Probeer later opnieuw.
      </div>
    );
  }

  if (videoProvider === "youtube" && videoUrl) {
    const match = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})(?:[?&#/]|$)/.exec(videoUrl);
    if (match) return <div className={frameClass}><iframe src={`https://www.youtube-nocookie.com/embed/${match[1]}`} title={title ?? "Video"} className="h-full w-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>;
  }
  if (!videoId) {
    return (
      <div className="market-media-state" role="status">
        <p className="text-sm px-4 text-center">
          Er is nog geen video beschikbaar.
        </p>
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <iframe
        ref={iframeRef}
        src={embedUrl ?? undefined}
        title={title ?? "Lesvideo"}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={() => setLoading(false)}
        onError={() => setProviderError(true)}
      />
      {loading && !providerError ? <p role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950 text-sm text-white/70">Video laden…</p> : null}
      {providerError ? <p role="alert" className="absolute inset-x-0 top-0 bg-stone-950/95 p-4 text-center text-sm text-white">De videoprovider kon deze video niet laden. Controleer je verbinding en vernieuw de pagina.</p> : null}
    </div>
  );
}
