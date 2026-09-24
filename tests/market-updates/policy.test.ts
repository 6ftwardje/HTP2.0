import test from "node:test";
import assert from "node:assert/strict";
import { validateMarketUpdatePublication } from "../../lib/market-update-policy.ts";

const body = "BTC breekt door de weerstand, maar bevestiging ontbreekt nog.";

test("video keeps the existing Mux-ready gate", () => {
  assert.match(validateMarketUpdatePublication({ contentFormat: "video", body: null, imagePaths: [], muxReady: false }) ?? "", /Mux-video/);
  assert.equal(validateMarketUpdatePublication({ contentFormat: "video", body: null, imagePaths: [], muxReady: true }), null);
});

test("chart needs commentary and a completed image", () => {
  assert.match(validateMarketUpdatePublication({ contentFormat: "chart", body: "kort", imagePaths: ["chart.png"], muxReady: false }) ?? "", /20 tekens/);
  assert.match(validateMarketUpdatePublication({ contentFormat: "chart", body, imagePaths: [], muxReady: false }) ?? "", /chart/);
  assert.equal(validateMarketUpdatePublication({ contentFormat: "chart", body, imagePaths: ["chart.png"], muxReady: false }), null);
});

test("text needs commentary but no image or video", () => {
  assert.match(validateMarketUpdatePublication({ contentFormat: "text", body: "   ", imagePaths: [], muxReady: false }) ?? "", /20 tekens/);
  assert.equal(validateMarketUpdatePublication({ contentFormat: "text", body, imagePaths: [], muxReady: false }), null);
});
