"use client";

import { useCallback, useTransition } from "react";
import { markWeeklyUpdateWatched } from "@/app/actions/weekly-updates";
import { VimeoPlayer } from "@/components/VimeoPlayerCore";
import type { MarketInsightChapter, MuxPlaybackTokens } from "@/lib/types";
import { MobileVideoChapters, useVideoChapters, VideoChapterLayout } from "@/components/market-insight/VideoChapterLayout";

type Props = {
  weeklyUpdateId: number; videoUrl: string | null; videoProvider?: string;
  muxPlaybackId?: string | null; muxPlaybackPolicy?: "public" | "signed";
  title?: string; muxTokens?: MuxPlaybackTokens | null; chapters?: MarketInsightChapter[];
};
export function WeeklyUpdateAutoCompleteVideo(props: Props) {
  const chapters = useVideoChapters();
  if (!chapters) return <VideoChapterLayout chapters={props.chapters ?? []} provider={props.videoProvider}><WeeklyUpdatePlayer {...props} /></VideoChapterLayout>;
  return <WeeklyUpdatePlayer {...props} />;
}
function WeeklyUpdatePlayer({ weeklyUpdateId, videoUrl, videoProvider, muxPlaybackId, muxPlaybackPolicy, title, muxTokens }: Props) {
  const [, startTransition] = useTransition();
  const chapters = useVideoChapters()!;
  const onEnded = useCallback(() => { startTransition(async () => { await markWeeklyUpdateWatched(weeklyUpdateId); }); }, [weeklyUpdateId]);
  return <div className="min-w-0 space-y-4">
    <VimeoPlayer surface="insight" videoUrl={videoUrl} videoProvider={videoProvider} muxPlaybackId={muxPlaybackId} muxPlaybackPolicy={muxPlaybackPolicy}
      muxTokens={muxTokens} title={title} onEnded={onEnded} enableSeeking={chapters.chapters.length > 0 || !!chapters.seekRequest}
      seekRequest={chapters.seekRequest} onTimeUpdate={chapters.onPosition} onSeekError={chapters.onSeekError} />
    <MobileVideoChapters />
  </div>;
}
