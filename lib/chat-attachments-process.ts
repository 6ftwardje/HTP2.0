import { createHash } from "node:crypto";
import sharp from "sharp";

export const CHAT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_PIXELS = 25_000_000;
export const CHAT_ATTACHMENT_MAX_DIMENSION = 10_000;
const OUTPUT_MAX_DIMENSION = 4096;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export class ChatAttachmentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); this.name = "ChatAttachmentError"; }
}

export function screenshotFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/["<>:|?*]/g, "_").replace(/\s+/g, " ").trim();
  const stem = base.replace(/\.[^.]*$/, "").replace(/^\.+/, "").trim().slice(0, 110) || "Screenshot";
  return `${stem}.webp`;
}

/** Bound bytes while reading, including requests without Content-Length. */
export async function readChatAttachmentForm(request: Request): Promise<FormData> {
  const limit = CHAT_ATTACHMENT_MAX_BYTES + MULTIPART_OVERHEAD_BYTES;
  if (Number(request.headers.get("content-length")) > limit) {
    throw new ChatAttachmentError("Kies een screenshot van maximaal 4 MB.", 413);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new ChatAttachmentError("Kies een screenshot.");
  const reader = request.body?.getReader();
  if (!reader) throw new ChatAttachmentError("Kies een screenshot.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ChatAttachmentError("Kies een screenshot van maximaal 4 MB.", 413); }
      chunks.push(next.value);
    }
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    if (error instanceof ChatAttachmentError) throw error;
    throw new ChatAttachmentError("Het bestand kon niet worden gelezen. Kies het opnieuw.");
  } finally { reader.releaseLock(); }
}

export async function processChatScreenshot(input: Buffer, originalName: string) {
  if (!input.length || input.length > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new ChatAttachmentError("Kies een screenshot van maximaal 4 MB.", input.length > CHAT_ATTACHMENT_MAX_BYTES ? 413 : 400);
  }
  const options = { limitInputPixels: CHAT_ATTACHMENT_MAX_PIXELS, failOn: "warning" as const };
  try {
    const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
    const webp = input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpeg && !webp) throw new Error("format");
    if (png) {
      for (let offset = 8; offset + 12 <= input.length;) {
        const length = input.readUInt32BE(offset);
        if (input.toString("ascii", offset + 4, offset + 8) === "acTL") throw new Error("animation");
        if (offset + length + 12 > input.length) throw new Error("truncated chunk");
        offset += length + 12;
      }
    }
    const metadata = await sharp(input, options).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1
      || !metadata.width || !metadata.height
      || metadata.width > CHAT_ATTACHMENT_MAX_DIMENSION || metadata.height > CHAT_ATTACHMENT_MAX_DIMENSION) throw new Error("dimensions");
    // Decode all source pixels with strict warnings, normalize orientation,
    // then rebuild from raw pixels to strip EXIF/location/ICC metadata.
    const decoded = await sharp(input, options).rotate().raw().toBuffer({ resolveWithObject: true });
    const image = () => sharp(decoded.data, { raw: { width: decoded.info.width, height: decoded.info.height, channels: decoded.info.channels } })
      .resize(OUTPUT_MAX_DIMENSION, OUTPUT_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
    let output = await image().webp({ lossless: true, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (output.data.length > CHAT_ATTACHMENT_MAX_BYTES) output = await image().webp({ quality: 90, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (output.data.length > CHAT_ATTACHMENT_MAX_BYTES) throw new Error("output size");
    return { bytes: output.data, width: output.info.width, height: output.info.height,
      mediaType: "image/webp" as const, sizeBytes: output.data.length,
      fileName: screenshotFileName(originalName), contentSha256: createHash("sha256").update(output.data).digest("hex") };
  } catch {
    throw new ChatAttachmentError("Deze afbeelding kan niet veilig worden verwerkt. Kies een statische PNG, JPEG of WebP van maximaal 4 MB en 25 megapixels.");
  }
}
