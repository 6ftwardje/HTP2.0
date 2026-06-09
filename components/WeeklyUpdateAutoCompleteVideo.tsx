"use client";

import { useCallback, useTransition } from "react";
import { markWeeklyUpdateWatched } from "@/app/actions/weekly-updates";
import { VimeoPlayer } from "@/components/VimeoPlayer";

export function WeeklyUpdateAutoCompleteVideo({
  weeklyUpdateId,
  videoUrl,
  videoProvider,
  muxPlaybackId,
  muxPlaybackPolicy,
  title,
}: {
  weeklyUpdateId: number;
  videoUrl: string | null;
  videoProvider?: string;
  muxPlaybackId?: string | null;
  muxPlaybackPolicy?: "public" | "signed";
  title?: string;
}) {
  const [, startTransition] = useTransition();

  const onEnded = useCallback(() => {
    startTransition(async () => {
      await markWeeklyUpdateWatched(weeklyUpdateId);
    });
  }, [weeklyUpdateId]);

  return (
    <VimeoPlayer
      videoUrl={videoUrl}
      videoProvider={videoProvider}
      muxPlaybackId={muxPlaybackId}
      muxPlaybackPolicy={muxPlaybackPolicy}
      title={title}
      onEnded={onEnded}
    />
  );
}
