"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoPlayer } from "@/components/VimeoPlayerLegacy";
import { markLessonComplete } from "@/app/actions/progress";
import type { MuxPlaybackTokens } from "@/lib/types";

export function LessonAutoCompleteVideo({
  lessonId,
  videoUrl,
  videoProvider,
  muxPlaybackId,
  muxPlaybackPolicy,
  title,
  isCompleted,
  muxTokens,
}: {
  lessonId: number;
  videoUrl: string | null;
  videoProvider?: string;
  muxPlaybackId?: string | null;
  muxPlaybackPolicy?: "public" | "signed";
  title?: string;
  isCompleted: boolean;
  muxTokens?: MuxPlaybackTokens | null;
}) {
  const router = useRouter();
  const didMarkRef = useRef(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveProgress() {
    if (isCompleted) return;
    if (didMarkRef.current) return;
    didMarkRef.current = true;
    setError(null);
    setMarking(true);
    try {
      const res = await markLessonComplete(lessonId);
      if (!res.success) {
        didMarkRef.current = false;
        setError(res.error ?? "Je voortgang kon niet worden opgeslagen.");
        return;
      }
      router.refresh();
    } catch {
      didMarkRef.current = false;
      setError("De verbinding werd onderbroken. Probeer je voortgang opnieuw op te slaan.");
    } finally {
      setMarking(false);
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
        muxTokens={muxTokens}
        onEnded={saveProgress}
      />
      {marking ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-4">
          <div className="cb-panel px-4 py-2">
            <span className="cb-caption">Voortgang opslaan...</span>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-[var(--foreground)]">{error}</p>
          <button
            type="button"
            onClick={() => void saveProgress()}
            disabled={marking}
            className="text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline disabled:opacity-50"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : null}
    </div>
  );
}
