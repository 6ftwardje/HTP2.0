import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { processAvatar } from "../../lib/avatars/process";
import { sanitizeArticle, articleReadingMinutes, formatPostPublication } from "../../lib/market-article";

const crop = { x: 0, y: 0, width: 64, height: 64 };
for (const format of ["jpeg", "png", "webp"] as const) {
  test(`${format} is decoded, cropped and reencoded without metadata`, async () => {
    const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#75819c" } }).withMetadata().toFormat(format).toBuffer();
    const avatar = await processAvatar(source, { x: 100, y: 50, width: 500, height: 500 });
    const metadata = await sharp(avatar).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 500); assert.equal(metadata.height, 500);
    assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
  });
}
test("EXIF orientation is normalized before cropping; result is at most 512 square", async () => {
  const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const avatar = await processAvatar(source, { x: 0, y: 100, width: 600, height: 600 });
  const metadata = await sharp(avatar).metadata();
  assert.equal(metadata.width, 512); assert.equal(metadata.height, 512);
  assert.equal(metadata.orientation, undefined);
});
test("invalid, disguised, oversized, animated and malicious crops are rejected", async () => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "red" } }).png().toBuffer();
  const apngChunk = Buffer.from([0,0,0,8, 97,99,84,76, 0,0,0,2, 0,0,0,0, 0,0,0,0]);
  const apng = Buffer.concat([png.subarray(0, 8), apngChunk, png.subarray(8)]);
  for (const source of [Buffer.from("fake.png"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>'), Buffer.alloc(5 * 1024 * 1024 + 1), png.subarray(0, 48), apng]) await assert.rejects(processAvatar(source, crop));
  const huge = await sharp({ create: { width: 6000, height: 6000, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(processAvatar(huge, crop));
  for (const bad of [{ ...crop, x: -1 }, { ...crop, width: 63, height: 20 }, { ...crop, x: 2 ** 40 }, { ...crop, width: 0 }, { ...crop, x: 0.1 }]) await assert.rejects(processAvatar(png, bad));
});
test("article formatting/order survives, executable markup and unsafe image sources do not", () => {
  const html = sanitizeArticle('<h2>Kop</h2><p><strong>Tekst</strong><script>alert(1)</script></p><figure><img src="https://example.com/chart.png" alt="Bestaande caption" width="1200" height="600" onerror="alert(1)"><figcaption>Origineel</figcaption></figure><img src="data:image/svg+xml,evil"><a href="javascript:alert(1)">Link</a>');
  assert.match(html, /<strong>Tekst<\/strong>/); assert.match(html, /width="1200"/);
  assert.ok(html.indexOf("Tekst") < html.indexOf("chart.png"));
  assert.ok(!/script|onerror|javascript:|data:image/.test(html));
});
test("reading duration uses only real text and publication timezone is explicit", () => {
  assert.equal(articleReadingMinutes('<img src="https://example.com/image.png">'), null);
  assert.equal(articleReadingMinutes("<p>" + "woord ".repeat(441) + "</p>"), 3);
  assert.match(formatPostPublication("2026-10-07T10:00:00Z"), /12:00/);
  assert.match(formatPostPublication("2026-01-07T10:00:00Z"), /11:00/);
});
