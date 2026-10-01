import { test } from "node:test";
import assert from "node:assert/strict";
import { amountAt, buildReport, expandItems, rentForMonth, splitCents } from "./calc.ts";
import type { Item, Person } from "./types.ts";

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
    { itemId: 1, categoryId: 1, amount: 10001, month: "2026-01" },
    { itemId: 2, categoryId: 2, amount: 4999, month: "2026-01" },
    { itemId: 3, categoryId: 1, amount: 333, month: "2026-08" },
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

const item = (p: Partial<Item>): Item => ({
  id: 1, categoryId: 1, description: "", note: "", interval: 1, startMonth: "2026-01", endMonth: null,
  amounts: [{ id: 1, validFrom: "2026-01", amount: 10000 }], ...p,
});
const sumBy = (cs: { month: string; amount: number }[]) =>
  cs.reduce<Record<string, number>>((a, c) => ((a[c.month] = (a[c.month] ?? 0) + c.amount), a), {});

test("amountAt: Betrag gilt bis zur nächsten Änderung", () => {
  const it = item({ amounts: [{ id: 1, validFrom: "2026-01", amount: 100 }, { id: 2, validFrom: "2026-05", amount: 150 }] });
  assert.equal(amountAt(it, "2025-11"), 100);
  assert.equal(amountAt(it, "2026-04"), 100);
  assert.equal(amountAt(it, "2026-05"), 150);
  assert.equal(amountAt(it, "2030-01"), 150);
});

test("expandItems: monatlich läuft weiter, Änderung ab Monat X", () => {
  const it = item({ amounts: [{ id: 1, validFrom: "2026-01", amount: 9000 }, { id: 2, validFrom: "2026-04", amount: 9500 }] });
  const m = sumBy(expandItems([it], "2025-10", "2026-06"));
  assert.deepEqual(m, { "2026-01": 9000, "2026-02": 9000, "2026-03": 9000, "2026-04": 9500, "2026-05": 9500, "2026-06": 9500 });
});

test("expandItems: jährlich wird auf 12 Monate verteilt, Summe exakt", () => {
  const it = item({ interval: 12, startMonth: "2026-02", amounts: [{ id: 1, validFrom: "2026-02", amount: 60001 }] });
  const cs = expandItems([it], "2026-01", "2027-12");
  const m = sumBy(cs);
  assert.equal(m["2026-01"], undefined);
  assert.ok(Math.abs(m["2026-02"] - 5000) <= 1);
  const firstPeriod = cs.filter((c) => c.month >= "2026-02" && c.month <= "2027-01").reduce((s, c) => s + c.amount, 0);
  assert.equal(firstPeriod, 60001);
  assert.equal(cs.length, 23); // Feb 2026 – Dez 2027
});

test("expandItems: Quartal, Zeitraum mitten in Periode, Betragswechsel zu Periodenbeginn", () => {
  const it = item({ interval: 3, startMonth: "2026-01", amounts: [{ id: 1, validFrom: "2026-01", amount: 30000 }, { id: 2, validFrom: "2026-05", amount: 36000 }] });
  const m = sumBy(expandItems([it], "2026-02", "2026-09"));
  // Q2 beginnt im April → gilt noch alter Betrag; Q3 ab Juli → neuer Betrag
  assert.deepEqual(m, { "2026-02": 10000, "2026-03": 10000, "2026-04": 10000, "2026-05": 10000, "2026-06": 10000, "2026-07": 12000, "2026-08": 12000, "2026-09": 12000 });
});

test("expandItems: Ende und einmalige Posten", () => {
  const ended = item({ id: 2, endMonth: "2026-03" });
  const once = item({ id: 3, interval: 0, startMonth: "2026-05", amounts: [{ id: 3, validFrom: "2026-05", amount: 25000 }] });
  const m = sumBy(expandItems([ended, once], "2026-01", "2026-12"));
  assert.deepEqual(m, { "2026-01": 10000, "2026-02": 10000, "2026-03": 10000, "2026-05": 25000 });
  assert.deepEqual(expandItems([once], "2026-06", "2026-12"), []);
});
