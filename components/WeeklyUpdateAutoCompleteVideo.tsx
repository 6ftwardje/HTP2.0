"use client";

import { useCallback, useState, useTransition } from "react";
import { markWeeklyUpdateWatched } from "@/app/actions/weekly-updates";
import { VimeoPlayer } from "@/components/VimeoPlayerLegacy";
import type { MuxPlaybackTokens } from "@/lib/types";
import {
  createVideoSeekRequest,
  formatChapterTime,
  type VideoSeekRequest,
} from "@/lib/video-seek";

export function WeeklyUpdateAutoCompleteVideo({
  weeklyUpdateId,
  videoUrl,
  videoProvider,
  muxPlaybackId,
  muxPlaybackPolicy,
  title,
  muxTokens,
  chapters = [],
}: {
  weeklyUpdateId: number;
  videoUrl: string | null;
  videoProvider?: string;
  muxPlaybackId?: string | null;
  muxPlaybackPolicy?: "public" | "signed";
  title?: string;
  muxTokens?: MuxPlaybackTokens | null;
  chapters?: Array<{ title: string; seconds: number }>;
}) {
  const [, startTransition] = useTransition();
  const [seekRequest, setSeekRequest] = useState<VideoSeekRequest | null>(null);

  const onEnded = useCallback(() => {
    startTransition(async () => {
      await markWeeklyUpdateWatched(weeklyUpdateId);
    });
  }, [weeklyUpdateId]);

  return (
    <div className="min-w-0 space-y-4">
      <VimeoPlayer
        videoUrl={videoUrl}
        videoProvider={videoProvider}
        muxPlaybackId={muxPlaybackId}
        muxPlaybackPolicy={muxPlaybackPolicy}
        title={title}
        muxTokens={muxTokens}
        onEnded={onEnded}
        enableSeeking={chapters.length > 0}
        seekRequest={seekRequest}
      />
      {chapters.length > 0 ? (
        <nav aria-label="Videohoofdstukken" className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="cb-eyebrow">Hoofdstukken</div>
          </div>
          <ol className="divide-y divide-[var(--border)]">
            {chapters.map((chapter) => (
              <li key={`${chapter.seconds}-${chapter.title}`}>
                <button
                  type="button"
                  className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 text-left text-sm transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--foreground)]"
                  onClick={() =>
                    setSeekRequest((previous) =>
                      createVideoSeekRequest(chapter.seconds, previous)
                    )
                  }
                  aria-label={`Ga naar ${chapter.title} op ${formatChapterTime(chapter.seconds)}`}
                >
                  <span className="font-mono text-[var(--muted)]">
                    {formatChapterTime(chapter.seconds)}
                  </span>
                  <span className="min-w-0 break-words font-semibold text-[var(--foreground)]">
                    {chapter.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}
