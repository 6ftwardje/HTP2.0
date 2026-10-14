import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { CHAT_ATTACHMENT_MAX_BYTES, ChatAttachmentError, processChatScreenshot, readChatAttachmentForm, screenshotFileName } from "../../lib/chat-attachments-process";

for (const format of ["jpeg", "png", "webp"] as const) {
  test(`screenshots: ${format} preserves the full chart ratio and strips metadata`, async () => {
    const source = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#f2f3f5" } }).withMetadata().toFormat(format).toBuffer();
    const image = await processChatScreenshot(source, `BTC ${format}.${format}`);
    const metadata = await sharp(image.bytes).metadata();
    assert.equal(metadata.format, "webp"); assert.equal(image.mediaType, "image/webp");
    assert.equal(metadata.width, 1600); assert.equal(metadata.height, 900);
    assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined); assert.equal(metadata.xmp, undefined);
    assert.equal(image.sizeBytes, image.bytes.length); assert.equal(image.contentSha256.length, 64);
    assert.match(image.fileName, /\.webp$/);
  });
}
test("screenshots: EXIF orientation is normalized and large charts resize without cropping", async () => {
  const source = await sharp({ create: { width: 6000, height: 3000, channels: 3, background: "#bbdaff" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const image = await processChatScreenshot(source, "chart.jpg");
  assert.equal(image.width, 2048); assert.equal(image.height, 4096);
  assert.equal((await sharp(image.bytes).metadata()).orientation, undefined);
});
test("screenshots: reject executable, disguised, oversized, animated, truncated and excessive-pixel inputs", async () => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "red" } }).png().toBuffer();
  const animation = Buffer.concat([png.subarray(0, 8), Buffer.from([0, 0, 0, 8, 97, 99, 84, 76, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]), png.subarray(8)]);
  const huge = await sharp({ create: { width: 5100, height: 5000, channels: 3, background: "red" } }).png().toBuffer();
  const tooWide = await sharp({ create: { width: 10001, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  for (const source of [Buffer.from("fake.png"), Buffer.from("<html><script>alert(1)</script></html>"),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>'),
    Buffer.alloc(CHAT_ATTACHMENT_MAX_BYTES + 1), png.subarray(0, 48), animation, huge, tooWide]) {
    await assert.rejects(processChatScreenshot(source, "looks-like-a-chart.png"), ChatAttachmentError);
  }
});
test("screenshots: trailing JPEG payload is removed by decoding and re-encoding", async () => {
  const jpg = await sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } }).jpeg().toBuffer();
  const image = await processChatScreenshot(Buffer.concat([jpg, Buffer.from("<script>private-payload</script>")]), "chart.jpg");
  assert.equal(image.bytes.includes(Buffer.from("private-payload")), false);
});
test("screenshots: filenames cannot carry paths, header controls or directional spoofing", () => {
  assert.equal(screenshotFileName("../../BTC chart.png"), "BTC chart.webp");
  assert.equal(screenshotFileName("..\\chart\r\n\".png"), "chart_.webp");
  assert.equal(screenshotFileName("\u202eevil.png"), "evil.webp");
  assert.ok(screenshotFileName("x".repeat(300) + ".png").length <= 120);
});
test("screenshots: unknown-length multipart streams stop at the byte boundary", async () => {
  let cancelled = false; let chunksRead = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { chunksRead++; controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelled = true; },
  });
  const request = new Request("http://localhost/upload", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=test" }, body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readChatAttachmentForm(request), (error: unknown) => error instanceof ChatAttachmentError && error.status === 413);
  assert.equal(cancelled, true); assert.ok(chunksRead <= 7);
});
test("screenshots: standard multipart form stays usable within the limit", async () => {
  const form = new FormData(); form.set("upload_intent", "example"); form.set("file", new Blob(["image bytes"]), "chart.png");
  const parsed = await readChatAttachmentForm(new Request("http://localhost/upload", { method: "POST", body: form }));
  assert.equal(parsed.get("upload_intent"), "example"); assert.equal((parsed.get("file") as File).name, "chart.png");
});
