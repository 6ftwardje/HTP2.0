/**
 * Extract Vimeo video ID or embed path from common URL formats.
 * Returns null if not a recognized Vimeo URL.
 */
export function extractVimeoId(videoUrl: string | null): string | null {
  if (!videoUrl || typeof videoUrl !== "string") return null;
  const trimmed = videoUrl.trim();
  if (!trimmed) return null;

  // https://vimeo.com/123456789
  const vimeoCom = /vimeo\.com\/(\d+)/i.exec(trimmed);
  if (vimeoCom) return vimeoCom[1];

  // https://player.vimeo.com/video/123456789
  const playerVideo = /player\.vimeo\.com\/video\/(\d+)/i.exec(trimmed);
  if (playerVideo) return playerVideo[1];

  // Already just digits (e.g. from embed)
  if (/^\d+$/.test(trimmed)) return trimmed;

  return null;
}

export function getVimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}`;
}
