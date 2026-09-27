import assert from "node:assert/strict";
import test from "node:test";
import { marketUpdateAuthorName, publicAuthorName } from "../../lib/market-update-author.ts";

test("publishing name comes from the authenticated account", () => {
  assert.equal(publicAuthorName({ name: "  Rousso  ", email: "mentor@example.com" }), "Rousso");
  assert.equal(publicAuthorName({ name: "Onbekend", email: "ward@example.com" }), "ward");
  assert.equal(publicAuthorName({ name: null, email: "admin@example.com" }), "admin");
});

test("posts show the publisher snapshot and videos retain the mentor", () => {
  assert.equal(marketUpdateAuthorName({ content_format: "text", published_by_display_name: "Ward", mentor: { name: "Another mentor" } }), "Ward");
  assert.equal(marketUpdateAuthorName({ content_format: "chart", published_by_display_name: "Ward", mentor: null }), "Ward");
  assert.equal(marketUpdateAuthorName({ content_format: "video", published_by_display_name: "Ward", mentor: { name: "Rousso" } }), "Rousso");
  assert.equal(marketUpdateAuthorName({ content_format: "text", published_by_display_name: null, mentor: null }), "HTP-team");
});
