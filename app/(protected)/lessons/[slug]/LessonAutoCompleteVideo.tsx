"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoPlayer } from "@/components/VimeoPlayer";
import { markLessonComplete } from "@/app/actions/progress";

export function LessonAutoCompleteVideo({
  lessonId,
  videoUrl,
  videoProvider,
  muxPlaybackId,
  muxPlaybackPolicy,
  title,
  isCompleted,
}: {
  lessonId: number;
  videoUrl: string | null;
  videoProvider?: string;
  muxPlaybackId?: string | null;
  muxPlaybackPolicy?: "public" | "signed";
  title?: string;
  isCompleted: boolean;
}) {
  const router = useRouter();
  const didMarkRef = useRef(false);
  const [marking, setMarking] = useState(false);

  async function handleEnded() {
    if (isCompleted) return;
    if (didMarkRef.current) return;
    didMarkRef.current = true;

    setMarking(true);
    const res = await markLessonComplete(lessonId);
    setMarking(false);

    if (res.success) {
      router.refresh();
    } else {
      // Intentionally silent: the page will still reflect latest progress on refresh.
      console.error(res.error ?? "De les kon niet als afgerond worden gemarkeerd.");
    }
  }

  return (
    <div className="relative">
      <VimeoPlayer
        videoUrl={videoUrl}
        videoProvider={videoProvider}
        muxPlaybackId={muxPlaybackId}
        muxPlaybackPolicy={muxPlaybackPolicy}
        title={title}
        onEnded={handleEnded}
      />
      {marking ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-4">
          <div className="cb-panel px-4 py-2">
            <span className="cb-caption">Voortgang opslaan...</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
