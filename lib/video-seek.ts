export type VideoSeekRequest = { seconds: number; nonce: number };

export function createVideoSeekRequest(
  seconds: number,
  previous: VideoSeekRequest | null
): VideoSeekRequest {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Ongeldige hoofdstuktijd.");
  }
  return { seconds, nonce: (previous?.nonce ?? 0) + 1 };
}

export function formatChapterTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
