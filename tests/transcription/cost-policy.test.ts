import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCostGate } from "../../lib/transcription/cost-policy";

test("fails closed when pricing is unknown", () => {
  assert.equal(
    evaluateCostGate({ estimatedEuro: null, monthSpendEuro: 0, priceConfigurationCurrent: false }).allowed,
    false
  );
});

test("blocks the monthly ceiling before a paid call", () => {
  const result = evaluateCostGate({
    estimatedEuro: 1.5,
    monthSpendEuro: 49,
    priceConfigurationCurrent: true,
  });
  assert.deepEqual(result, {
    allowed: false,
    reason: "Maandelijkse kostenlimiet wordt overschreden.",
  });
});
