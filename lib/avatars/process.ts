import sharp from "sharp";

export const AVATAR_SOURCE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const MAX_DIMENSION = 10_000;
export type AvatarCrop = { x: number; y: number; width: number; height: number };

export async function processAvatar(input: Buffer, crop: AvatarCrop): Promise<Buffer> {
  if (!input.length || input.length > AVATAR_SOURCE_MAX_BYTES) throw new Error("Kies een afbeelding van maximaal 5 MB.");
  const options = { limitInputPixels: MAX_PIXELS, failOn: "warning" as const };
  try {
    const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
    const webp = input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpeg && !webp) throw new Error("format");
    // libvips may decode only the first APNG frame. Reject animation chunks
    // explicitly rather than assuming metadata.pages covers every PNG decoder.
    if (png) {
      for (let offset = 8; offset + 12 <= input.length;) {
        const length = input.readUInt32BE(offset);
        if (input.toString("ascii", offset + 4, offset + 8) === "acTL") throw new Error("animation");
        offset += length + 12;
      }
    }
    const metadata = await sharp(input, options).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) {
      throw new Error("format");
    }
    if (!metadata.width || !metadata.height || metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) throw new Error("dimensions");
    // Decode the entire original with strict warnings before extracting. Auto-orient
    // first so browser crop coordinates agree with EXIF-oriented images.
    const oriented = await sharp(input, options).rotate().raw().toBuffer({ resolveWithObject: true });
    const { x, y, width, height } = crop;
    if (![x, y, width, height].every(Number.isSafeInteger) || x < 0 || y < 0 || width < 1 || height < 1 || Math.abs(width - height) > 1 || x + width > oriented.info.width || y + height > oriented.info.height) throw new Error("crop");
    // Raw pixels remove all EXIF/location/ICC metadata. Output is always static.
    return await sharp(oriented.data, { raw: { width: oriented.info.width, height: oriented.info.height, channels: oriented.info.channels } })
      .extract({ left: x, top: y, width, height })
      .resize(512, 512, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 }).toBuffer();
  } catch {
    throw new Error("Deze foto kan niet veilig worden verwerkt. Kies een statische JPEG, PNG of WebP (maximaal 25 megapixels). Controleer ook de uitsnede.");
  }
}
