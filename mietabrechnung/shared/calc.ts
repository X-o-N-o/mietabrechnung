import type { Category, Charge, Item, MonthReport, Person, PersonAmounts, Rent, Report } from "./types.ts";

/**
 * Teilt einen Cent-Betrag nach Gewichten auf, sodass die Summe exakt stimmt
 * (Largest-Remainder-Verfahren). Restcents gehen an die Positionen mit dem
 * größten Bruchteil; bei Gleichstand rotiert der Start über `offset`, damit
 * nicht immer dieselbe Person den Extra-Cent bekommt.
 */
export function splitCents(total: number, weights: number[], offset = 0): number[] {
  const n = weights.length;
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (n === 0 || sumW <= 0) return weights.map(() => 0);

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const exact = weights.map((w) => (abs * w) / sumW);
  const base = exact.map(Math.floor);
  let rest = abs - base.reduce((a, b) => a + b, 0);

  const order = weights
    .map((_, i) => i)
    .filter((i) => weights[i] > 0)
    .sort((a, b) => {
      const diff = exact[b] - base[b] - (exact[a] - base[a]);
      if (Math.abs(diff) > 1e-9) return diff;
      return ((a - offset) % n + n) % n - (((b - offset) % n + n) % n);
    });

  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) base[order[k]]++;
  return base.map((v) => v * sign || 0);
}

export function monthIndex(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function monthFromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = monthIndex(from); i <= monthIndex(to); i++) out.push(monthFromIndex(i));
  return out;
}

/** Gültige Gesamtmiete für einen Monat (letzte Mietangabe mit validFrom <= Monat). */
export function rentForMonth(rents: Rent[], month: string): number {
  let current: Rent | undefined;
  for (const r of rents) {
    if (r.validFrom <= month && (!current || r.validFrom >= current.validFrom)) current = r;
  }
  return current?.amount ?? 0;
}

/** Betrag eines Postens, der für eine Fälligkeit im angegebenen Monat gilt. */
export function amountAt(item: Item, month: string): number {
  let current = item.amounts[0];
  for (const a of item.amounts) if (a.validFrom <= month && a.validFrom >= current.validFrom) current = a;
  return current?.amount ?? 0;
}

/**
 * Rechnet Posten in monatliche Belastungen für den Zeitraum from–to um.
 * Wiederkehrende Beträge werden gleichmäßig auf die Monate ihres Turnus verteilt
 * (z. B. Jahresbetrag / 12), einmalige Posten fallen voll im Startmonat an.
 * Der Betrag einer Periode richtet sich nach dem Wert, der zu Periodenbeginn gilt.
 */
export function expandItems(items: Item[], from: string, to: string): Charge[] {
  const lo = monthIndex(from);
  const hi = monthIndex(to);
  const out: Charge[] = [];
  for (const item of items) {
    if (item.amounts.length === 0) continue;
    const start = monthIndex(item.startMonth);
    const end = Math.min(item.endMonth ? monthIndex(item.endMonth) : Infinity, hi);
    const push = (idx: number, amount: number) => {
      if (idx >= lo && idx <= end && amount !== 0)
        out.push({ itemId: item.id, categoryId: item.categoryId, month: monthFromIndex(idx), amount });
    };

    if (item.interval === 0) {
      push(start, amountAt(item, item.startMonth));
      continue;
    }
    const n = item.interval;
    // erste Periode, die in den Zeitraum hineinreicht
    let period = start + Math.max(0, Math.floor((lo - start) / n)) * n;
    for (; period <= end; period += n) {
      const parts = splitCents(amountAt(item, monthFromIndex(period)), Array(n).fill(1), period);
      parts.forEach((p, j) => push(period + j, p));
    }
  }
  return out;
}

/** Durchschnittlicher Monatsbetrag eines Postens zum angegebenen Monat. */
export function monthlyAmount(item: Item, month: string): number {
  if (item.interval === 0) return 0;
  return Math.round(amountAt(item, month) / item.interval);
}

const emptyAmounts = (): PersonAmounts => ({ rent: 0, costs: 0, total: 0 });

export function buildReport(
  from: string,
  to: string,
  persons: Person[],
  categories: Category[],
  rents: Rent[],
  charges: Charge[],
): Report {
  const tenants = persons.filter((p) => p.role === "tenant");
  const shares = persons.map((p) => p.shares);

  const catMap = new Map(
    categories.map((c) => [c.id, { id: c.id, name: c.name, color: c.color, total: 0, perPerson: {} as Record<number, number> }]),
  );
  const totals = { rent: 0, costs: 0, perPerson: {} as Record<number, PersonAmounts> };
  for (const p of persons) totals.perPerson[p.id] = emptyAmounts();

  const months: MonthReport[] = monthRange(from, to).map((month) => {
    const mr: MonthReport = { month, rentTotal: 0, costTotal: 0, byCategory: {}, byItem: {}, persons: {} };
    for (const p of persons) mr.persons[p.id] = emptyAmounts();

    // Miete: Gesamtbetrag zu gleichen Teilen auf die Mieter
    mr.rentTotal = rentForMonth(rents, month);
    const rentSplit = splitCents(mr.rentTotal, tenants.map(() => 1), monthIndex(month));
    tenants.forEach((t, i) => (mr.persons[t.id].rent = rentSplit[i]));

    // Nebenkosten: jede Monatsbelastung nach Anteilen auf alle Personen
    for (const c of charges) {
      if (c.month !== month) continue;
      mr.costTotal += c.amount;
      mr.byCategory[c.categoryId] = (mr.byCategory[c.categoryId] ?? 0) + c.amount;
      mr.byItem[c.itemId] = (mr.byItem[c.itemId] ?? 0) + c.amount;
      const split = splitCents(c.amount, shares, c.itemId + monthIndex(month));
      const cat = catMap.get(c.categoryId);
      if (cat) cat.total += c.amount;
      persons.forEach((p, i) => {
        mr.persons[p.id].costs += split[i];
        if (cat) cat.perPerson[p.id] = (cat.perPerson[p.id] ?? 0) + split[i];
      });
    }

    for (const p of persons) {
      const a = mr.persons[p.id];
      a.total = a.rent + a.costs;
      const t = totals.perPerson[p.id];
      t.rent += a.rent;
      t.costs += a.costs;
      t.total += a.total;
    }
    totals.rent += mr.rentTotal;
    totals.costs += mr.costTotal;
    return mr;
  });

  return {
    from,
    to,
    persons,
    months,
    categories: [...catMap.values()].filter((c) => c.total !== 0),
    totals,
  };
}
