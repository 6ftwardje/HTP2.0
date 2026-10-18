export type VideoRef = { kind: "lesson" | "update"; id: number };
export type VideoPosition = { viewerId: string; videoVersion: string; revision: number; positionSeconds: number; durationSeconds: number; maxPositionSeconds: number; completed: boolean };
export const VIDEO_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const videoPositionKey = (video: VideoRef) => `${video.kind}:${video.id}`;
export function validVideoRef(kind: unknown, id: unknown): VideoRef | null {
  const value = typeof id === "number" ? id : typeof id === "string" && /^\d+$/.test(id) ? Number(id) : NaN;
  return (kind === "lesson" || kind === "update") && Number.isSafeInteger(value) && value > 0 ? {kind,id:value} : null;
}
export function validPositionBody(body: Record<string, unknown>) {
  return validVideoRef(body.kind,body.id) && typeof body.viewerId === "string" && typeof body.videoVersion === "string" && /^mux:[A-Za-z0-9_-]+$/.test(body.videoVersion)
    && typeof body.sessionId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.sessionId)
    && Number.isSafeInteger(body.revision) && Number(body.revision)>=0 && Number.isSafeInteger(body.sequence) && Number(body.sequence)>0
    && typeof body.positionSeconds === "number" && Number.isFinite(body.positionSeconds) && body.positionSeconds>=0
    && typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds) && body.durationSeconds>0 && body.durationSeconds<=604800 && body.positionSeconds<=body.durationSeconds;
}
export function preferredVideoRate(storage: Pick<Storage,"getItem">, viewerId: string): number {
  try { const raw=storage.getItem(`htp:video-rate:${viewerId}`);const rate=Number(raw);return (VIDEO_RATES as readonly number[]).includes(rate)?rate:1; } catch { return 1; }
}
export function storeVideoRate(storage: Pick<Storage,"setItem">,viewerId:string,rate:number) {
  if (!(VIDEO_RATES as readonly number[]).includes(rate))return;
  try {storage.setItem(`htp:video-rate:${viewerId}`,String(rate));}catch{/* Playback still works when storage is denied. */}
}
export function shouldOfferResume(position: VideoPosition) { return !position.completed && position.positionSeconds>=5 && position.durationSeconds>0 && position.positionSeconds/position.durationSeconds<0.95; }

/** Bound unsaved media time at faster rates without increasing writes for slow playback. */
export function videoSaveInterval(rate:number) { return 10000/Math.max(1,(VIDEO_RATES as readonly number[]).includes(rate)?rate:1); }
