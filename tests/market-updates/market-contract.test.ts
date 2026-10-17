import assert from "node:assert/strict";
import test from "node:test";
import { emptyStructure, getUpdateMarkets, matchesUpdateMarket } from "../../lib/market-update-structure";
import { formatMarketChapters, parseMarketChapters, readableMarketChapters, validateMarketChapters } from "../../lib/market-chapters";
import { getIsoWeekNumber } from "../../lib/market-analysis";

test("F3a projects all old/new tags without changing the source or treating perspective/type as markets", () => {
  const source = { markets: ["crypto", "gold", "trading", "macro", "indices", "general", "forex", "stocks", "commodities"], market: "crypto", update_structure: { ...emptyStructure(), category: "crypto" as const, perspective: "technical" as const } };
  const snapshot = structuredClone(source);
  assert.deepEqual(getUpdateMarkets(source), source.markets);
  for (const market of source.markets) assert.equal(matchesUpdateMarket(source, market), true);
  assert.equal(matchesUpdateMarket(source, "technical"), false);
  assert.equal(matchesUpdateMarket(source, "analysis"), false);
  assert.deepEqual(source, snapshot);
  assert.deepEqual(getUpdateMarkets({ markets: ["forex", "forex"], market: "crypto", update_structure: { ...emptyStructure(), category: "indices" } }), ["forex", "crypto", "indices"]);
  assert.deepEqual(getUpdateMarkets({ markets: ["crypto", "forex"], update_structure: emptyStructure() }), ["crypto", "forex"]);
});

test("F3a roundtrips old and market-linked chapters including times over an hour", () => {
  const text = "00:00 Intro\n12:40 Forex | forex\n1:12:03 Goud | gold";
  const parsed = parseMarketChapters(text);
  assert.ok(parsed.chapters);
  assert.equal(validateMarketChapters(parsed.chapters, 5000, ["forex", "gold"]), null);
  assert.deepEqual(parseMarketChapters(formatMarketChapters(parsed.chapters)), parsed);
  assert.equal(getIsoWeekNumber("2026-10-12"), 42);
  assert.equal(getIsoWeekNumber("2021-01-01"), 53);
  assert.deepEqual(parseMarketChapters(""), { chapters: [] });
});

test("F3a rejects bad chapter data and reads historical malformed entries defensively without mutating them", () => {
  for (const value of [null, {}, [null], [{ title: "", seconds: 0 }], [{ title: "x", seconds: -1 }], [{ title: "x", seconds: 0.1 }], [{ title: "x", seconds: 0, market: null }], [{ title: "x", seconds: 0, extra: true }]]) assert.ok(validateMarketChapters(value));
  const old = [{ title: "Goed", seconds: 0 }, { title: "Fout", seconds: -1 }, { title: "Goud", seconds: 20, market: "gold" }, { title: "Voorbij einde", seconds: 60 }];
  const before = structuredClone(old);
  assert.deepEqual(readableMarketChapters(old, 30), [old[0], old[2]]);
  assert.deepEqual(old, before);
  assert.ok(parseMarketChapters("0:60:00 Fout").error);
  assert.ok(validateMarketChapters([{ title: "Goud", seconds: 0, market: "gold" }], null, ["crypto"]));
});
