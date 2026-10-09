import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinMonthStart, monthCost } from "./ostrom.ts";

test("berlinMonthStart: Sommer- und Winterzeit", () => {
  assert.equal(berlinMonthStart("2026-09"), "2026-08-31T22:00:00.000Z");
  assert.equal(berlinMonthStart("2026-01"), "2025-12-31T23:00:00.000Z");
  assert.equal(berlinMonthStart("2026-04"), "2026-03-31T22:00:00.000Z"); // erster Monat nach Umstellung
});

const fee = { grossMonthlyOstromBaseFee: 6, grossMonthlyGridFees: 8.14 };

test("monthCost: Stundenverbrauch × Preis + Monatsgebühren", () => {
  const r = monthCost(
    [
      { date: "2026-09-01T00:00:00.000Z", kWh: 2 },
      { date: "2026-09-01T01:00:00.000Z", kWh: 1 },
    ],
    [
      { date: "2026-09-01T00:00:00.000Z", grossKwhPrice: 10, grossKwhTaxAndLevies: 15, ...fee },
      { date: "2026-09-01T01:00:00.000Z", grossKwhPrice: 20, grossKwhTaxAndLevies: 15, ...fee },
    ],
  );
  // 2 × 25 ct + 1 × 35 ct = 85 ct; Gebühren 14,14 €
  assert.deepEqual(r, { kwh: 3, energyAmount: 85, feesAmount: 1414, amount: 1499 });
});

test("monthCost: fehlende Preisstunde wird mit Durchschnitt hochgerechnet", () => {
  const r = monthCost(
    [
      { date: "2026-09-01T00:00:00.000Z", kWh: 1 },
      { date: "2026-09-01T01:00:00.000Z", kWh: 1 },
    ],
    [{ date: "2026-09-01T00:00:00.000Z", grossKwhPrice: 10, grossKwhTaxAndLevies: 20, ...fee }],
  );
  assert.equal(r.energyAmount, 60);
});
