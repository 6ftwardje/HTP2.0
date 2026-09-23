"use client";

import MuxPlayer, { type MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { useEffect, useRef } from "react";
import type { MuxPlaybackTokens } from "@/lib/types";
import type { VideoSeekRequest } from "@/lib/video-seek";

const COACHEDBY_RED = "#f50101";

export function MuxLessonPlayer({
  playbackId,
  title,
  onEnded,
  tokens,
  seekRequest,
}: {
  playbackId: string;
  title?: string;
  onEnded?: (() => void) | null;
  tokens?: MuxPlaybackTokens | null;
  seekRequest?: VideoSeekRequest | null;
}) {
  const playerRef = useRef<MuxPlayerRefAttributes | null>(null);

  useEffect(() => {
    if (!seekRequest || !playerRef.current) return;
    playerRef.current.currentTime = seekRequest.seconds;
    void playerRef.current.play().catch(() => undefined);
  }, [seekRequest]);

  return (
    <MuxPlayer
      ref={playerRef}
      playbackId={playbackId}
      videoTitle={title ?? "Lesvideo"}
      className="h-full w-full"
      primaryColor="#ffffff"
      secondaryColor="#0c0a09"
      accentColor={COACHEDBY_RED}
      onEnded={onEnded ?? undefined}
      streamType="on-demand"
      tokens={tokens ?? undefined}
    />
  );
}
