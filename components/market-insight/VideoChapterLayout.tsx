"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MarketInsightChapter } from "@/lib/types";
import { activeMarketChapter, parseVideoTimestamp, supportsMarketSeeking } from "@/lib/market-video-navigation";
import { createVideoSeekRequest, formatChapterTime, type VideoSeekRequest } from "@/lib/video-seek";
import styles from "./VideoChapterLayout.module.css";

type Navigation = {
  chapters: MarketInsightChapter[];
  supported: boolean;
  active: number;
  seekRequest: VideoSeekRequest | null;
  seek: (seconds: number) => void;
  onPosition: (seconds: number) => void;
  onSeekError: (message: string | null) => void;
};
const ChapterContext = createContext<Navigation | null>(null);
export const useVideoChapters = () => useContext(ChapterContext);

function ChapterList() {
  const navigation = useVideoChapters();
  if (!navigation?.chapters.length) return null;
  return <nav aria-label="In deze video" className={styles.list}>
    {!navigation.supported ? <p className={styles.help}>Deze oudere videoprovider ondersteunt hier geen hoofdstukbediening. Gebruik de tijdstippen in de speler.</p> : null}
    <ol>{navigation.chapters.map((chapter, index) => <li key={`${chapter.seconds}-${chapter.title}`}>
      {navigation.supported ? <button type="button" onClick={() => navigation.seek(chapter.seconds)} aria-current={navigation.active === index ? "true" : undefined}
        aria-label={`Ga naar ${chapter.title} op ${formatChapterTime(chapter.seconds)}`}>
        <span className={styles.time}>{formatChapterTime(chapter.seconds)}</span><span>{chapter.title}</span>
      </button> : <div className={styles.readOnly}><span className={styles.time}>{formatChapterTime(chapter.seconds)}</span><span>{chapter.title}</span></div>}
    </li>)}</ol>
  </nav>;
}

export function MobileVideoChapters() {
  const navigation = useVideoChapters();
  if (!navigation?.chapters.length) return null;
  return <details className={styles.mobile}><summary>In deze video</summary><ChapterList /></details>;
}

export function VideoChapterLayout({ chapters, provider = "mux", timestamp, duration, children }: {
  chapters: MarketInsightChapter[]; provider?: string; timestamp?: string | null; duration?: number | null; children: ReactNode;
}) {
  const [seconds, setSeconds] = useState(0);
  const [seekRequest, setSeekRequest] = useState<VideoSeekRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTimestamp = useRef<string | null | undefined>(undefined);
  const supported = supportsMarketSeeking(provider);
  const onPosition = useCallback((value: number) => { if (Number.isFinite(value) && value >= 0) setSeconds(value); }, []);
  const seek = useCallback((value: number) => {
    if (!supported) { setError("Deze videoprovider ondersteunt hier geen automatisch springen."); return; }
    if (duration != null && duration > 0 && value >= duration) { setError("Dit tijdstip valt buiten de video. Kies een hoofdstuk of speel vanaf het begin."); return; }
    setError(null);
    setSeekRequest((previous) => createVideoSeekRequest(value, previous));
  }, [supported, duration]);
  useEffect(() => {
    if (timestamp === lastTimestamp.current) return;
    lastTimestamp.current = timestamp;
    if (timestamp == null) return;
    const value = parseVideoTimestamp(timestamp);
    if (value === null) setError("Dit tijdstip is ongeldig. Kies een hoofdstuk of speel vanaf het begin.");
    else seek(value);
  }, [timestamp, seek]);
  const navigation = useMemo(() => ({ chapters, supported, active: activeMarketChapter(chapters, seconds), seekRequest, seek, onPosition, onSeekError: setError }), [chapters, supported, seconds, seekRequest, seek, onPosition]);
  return <ChapterContext.Provider value={navigation}>
    <div className={styles.layout} data-chapter-layout={chapters.length ? "rail" : "single"}>
      <div className={styles.body}>{error ? <p className={styles.notice} role="status">{error}</p> : null}{children}</div>
      {chapters.length ? <aside className={styles.rail}><h2>In deze video</h2><ChapterList /></aside> : null}
    </div>
  </ChapterContext.Provider>;
}
