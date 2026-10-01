import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, rentForMonth, splitCents } from "./calc.ts";
import type { Person } from "./types.ts";

const persons: Person[] = [
  { id: 1, name: "Dan", role: "owner", shares: 1, color: "", sort: 0 },
  { id: 2, name: "Oma", role: "owner", shares: 1, color: "", sort: 1 },
  { id: 3, name: "Jay", role: "tenant", shares: 1, color: "", sort: 2 },
  { id: 4, name: "Steve", role: "tenant", shares: 1, color: "", sort: 3 },
];
const cats = [{ id: 1, name: "Strom", color: "" }, { id: 2, name: "Wasser", color: "" }];

test("splitCents: Summe stimmt immer", () => {
  for (const total of [0, 1, 3, 100, 101, 12345, 99999, -101]) {
    for (const w of [[1, 1, 1, 1], [1, 1], [2, 1, 1], [1, 0, 1]]) {
      for (let off = 0; off < 4; off++) {
        const s = splitCents(total, w, off);
        assert.equal(s.reduce((a, b) => a + b, 0), total, `${total} ${w} ${off}`);
      }
    }
  }
});

test("splitCents: Rest rotiert mit offset", () => {
  assert.deepEqual(splitCents(101, [1, 1, 1, 1], 0), [26, 25, 25, 25]);
  assert.deepEqual(splitCents(101, [1, 1, 1, 1], 2), [25, 25, 26, 25]);
  assert.deepEqual(splitCents(0, [0, 0], 0), [0, 0]);
});

test("splitCents: Gewichte und Null-Anteile", () => {
  assert.deepEqual(splitCents(400, [2, 1, 1], 0), [200, 100, 100]);
  assert.deepEqual(splitCents(3, [1, 0, 1], 1), [1, 0, 2]);
});

test("rentForMonth: Mieterhöhung mitten im Jahr", () => {
  const rents = [
    { id: 1, amount: 120000, validFrom: "2026-01", note: "" },
    { id: 2, amount: 130000, validFrom: "2026-07", note: "" },
  ];
  assert.equal(rentForMonth(rents, "2025-12"), 0);
  assert.equal(rentForMonth(rents, "2026-06"), 120000);
  assert.equal(rentForMonth(rents, "2026-07"), 130000);
  assert.equal(rentForMonth(rents, "2027-03"), 130000);
});

test("buildReport: Miete nur Mieter, Nebenkosten durch 4, Summen konsistent", () => {
  const rents = [
    { id: 1, amount: 120001, validFrom: "2026-01", note: "" },
    { id: 2, amount: 130000, validFrom: "2026-07", note: "" },
  ];
  const costs = [
    { id: 1, categoryId: 1, description: "", amount: 10001, month: "2026-01", note: "" },
    { id: 2, categoryId: 2, description: "", amount: 4999, month: "2026-01", note: "" },
    { id: 3, categoryId: 1, description: "", amount: 333, month: "2026-08", note: "" },
  ];
  const r = buildReport("2026-01", "2026-12", persons, cats, rents, costs);

  const jan = r.months[0];
  assert.equal(jan.persons[1].rent, 0);
  assert.equal(jan.persons[2].rent, 0);
  assert.equal(jan.persons[3].rent + jan.persons[4].rent, 120001);
  assert.equal(jan.costTotal, 15000);
  for (const p of persons) assert.ok(Math.abs(jan.persons[p.id].costs - 3750) <= 1);
  assert.equal(r.months[6].persons[3].rent, 65000);

  const sumCosts = persons.reduce((s, p) => s + r.totals.perPerson[p.id].costs, 0);
  const sumRent = persons.reduce((s, p) => s + r.totals.perPerson[p.id].rent, 0);
  assert.equal(sumCosts, 15333);
  assert.equal(r.totals.costs, 15333);
  assert.equal(sumRent, r.totals.rent);
  assert.equal(r.totals.rent, 120001 * 6 + 130000 * 6);

  for (const c of r.categories) {
    const s = Object.values(c.perPerson).reduce((a, b) => a + b, 0);
    assert.equal(s, c.total);
  }
});
