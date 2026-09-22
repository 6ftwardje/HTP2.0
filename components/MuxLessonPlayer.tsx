"use client";

import MuxPlayer from "@mux/mux-player-react";
import type { MuxPlaybackTokens } from "@/lib/types";

const COACHEDBY_RED = "#f50101";

export function MuxLessonPlayer({
  playbackId,
  title,
  onEnded,
  tokens,
}: {
  playbackId: string;
  title?: string;
  onEnded?: (() => void) | null;
  tokens?: MuxPlaybackTokens | null;
}) {
  return (
    <MuxPlayer
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
