import assert from "node:assert/strict";
import { test } from "node:test";
import { relativeDate } from "../../lib/relative-date";

test("publication copy is Dutch and does not expose an absolute timestamp in the label", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  assert.equal(relativeDate("2026-10-17T11:55:00Z", now).label, "5 minuten geleden");
  assert.equal(relativeDate("2026-10-17T11:59:45Z", now).label, "zojuist");
  assert.equal(relativeDate("2026-10-15T11:00:00Z", now).label, "2 dagen geleden");
  assert.match(relativeDate("2026-10-17T11:55:00Z", now).exact, /13:55.*Brussel/);
});

test("yesterday and tomorrow follow Brussels calendar days, including the summer-time transition", () => {
  const now = Date.parse("2026-03-29T22:05:00Z"); // 00:05 on March 30 in Brussels.
  assert.equal(relativeDate("2026-03-29T21:59:00Z", now).label, "gisteren");
  assert.equal(relativeDate("2026-03-31T08:00:00Z", now).label, "morgen");
  assert.equal(relativeDate("2026-10-25T00:15:00Z", Date.parse("2026-10-25T01:45:00Z")).label, "1 uur geleden");
});

test("invalid and old dates are safe and preserve exact ISO metadata when valid", () => {
  assert.deepEqual(relativeDate("invalid"), { label: "Datum onbekend", exact: "Datum onbekend", dateTime: undefined });
  assert.equal(relativeDate("2020-01-01T00:00:00Z", Date.parse("2026-01-01T00:00:00Z")).label, "6 jaar geleden");
  assert.equal(relativeDate("2026-10-17T12:00:00+02:00").dateTime, "2026-10-17T10:00:00.000Z");
});
