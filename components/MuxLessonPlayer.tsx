"use client";

import MuxPlayer, { type MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { useEffect, useRef } from "react";
import type { MuxPlaybackTokens } from "@/lib/types";
import type { VideoSeekRequest } from "@/lib/video-seek";

export function MuxLessonPlayer({
  playbackId,
  title,
  onEnded,
  tokens,
  seekRequest,
  onError,
  onTimeUpdate,
  onSeekError,
  accentColor = "var(--accent)",
}: {
  playbackId: string;
  title?: string;
  onEnded?: (() => void) | null;
  tokens?: MuxPlaybackTokens | null;
  seekRequest?: VideoSeekRequest | null;
  onError?: () => void;
  onTimeUpdate?: (seconds: number) => void;
  onSeekError?: (message: string | null) => void;
  accentColor?: string;
}) {
  const playerRef = useRef<MuxPlayerRefAttributes | null>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!seekRequest || !player) return;
    let cancelled = false;
    let applied = false;
    const apply = () => {
      if (cancelled || applied || player.readyState === 0) return;
      applied = true;
      if (Number.isFinite(player.duration) && seekRequest.seconds >= player.duration) {
        onSeekError?.("Dit tijdstip valt buiten de video. Kies een hoofdstuk of speel vanaf het begin.");
        return;
      }
      try {
        player.currentTime = seekRequest.seconds;
        onSeekError?.(null);
        void player.play().catch(() => {
          if (!cancelled) onSeekError?.("Het tijdstip staat klaar. Druk op afspelen om verder te kijken.");
        });
      } catch {
        onSeekError?.("Springen is tijdelijk niet beschikbaar. Gebruik de tijdlijn in de speler.");
      }
    };
    player.addEventListener("loadedmetadata", apply);
    player.addEventListener("canplay", apply);
    apply();
    return () => {
      cancelled = true;
      player.removeEventListener("loadedmetadata", apply);
      player.removeEventListener("canplay", apply);
    };
  }, [seekRequest, playbackId, onSeekError]);

  return (
    <MuxPlayer
      ref={playerRef}
      playbackId={playbackId}
      videoTitle={title ?? "Lesvideo"}
      className="h-full w-full"
      primaryColor="var(--media-foreground)"
      secondaryColor="var(--media-background)"
      accentColor={accentColor}
      onError={onError}
      onEnded={onEnded ?? undefined}
      onTimeUpdate={() => onTimeUpdate?.(playerRef.current?.currentTime ?? 0)}
      onSeeked={() => onTimeUpdate?.(playerRef.current?.currentTime ?? 0)}
      streamType="on-demand"
      tokens={tokens ?? undefined}
    />
  );
}
