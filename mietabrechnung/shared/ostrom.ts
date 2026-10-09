// Reine Rechenfunktionen für den dynamischen Ostrom-Tarif (ohne Netzwerkzugriff, testbar).

export interface ConsumptionHour {
  date: string; // Stundenbeginn, ISO UTC
  kWh: number;
}

export interface PriceHour {
  date: string;
  grossKwhPrice: number; // ct/kWh
  grossKwhTaxAndLevies: number; // ct/kWh
  grossMonthlyOstromBaseFee: number; // €/Monat
  grossMonthlyGridFees: number; // €/Monat
}

export interface MonthCost {
  kwh: number;
  energyAmount: number; // Cent
  feesAmount: number; // Cent
  amount: number; // Cent, Summe
}

/** UTC-Zeitpunkt von Mitternacht am Monatsersten in Deutschland (Europe/Berlin). */
export function berlinMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, 1);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asLocal - guess)).toISOString();
}

/**
 * Monatskosten = Σ Stundenverbrauch × (Börsenpreis + Steuern/Umlagen) + Grundgebühr + Netzentgelt.
 * Stunden ohne Preis werden mit dem verbrauchsgewichteten Durchschnittspreis angesetzt.
 */
export function monthCost(hours: ConsumptionHour[], prices: PriceHour[]): MonthCost {
  const byTime = new Map(prices.map((p) => [new Date(p.date).getTime(), p]));
  let kwh = 0;
  let pricedKwh = 0;
  let energyCt = 0;
  for (const h of hours) {
    kwh += h.kWh;
    const p = byTime.get(new Date(h.date).getTime());
    if (!p) continue;
    pricedKwh += h.kWh;
    energyCt += h.kWh * (p.grossKwhPrice + p.grossKwhTaxAndLevies);
  }
  if (pricedKwh > 0 && pricedKwh < kwh) energyCt *= kwh / pricedKwh;

  const fee = prices[0] ?? { grossMonthlyOstromBaseFee: 0, grossMonthlyGridFees: 0 };
  const energyAmount = Math.round(energyCt);
  const feesAmount = Math.round((fee.grossMonthlyOstromBaseFee + fee.grossMonthlyGridFees) * 100);
  return { kwh: Math.round(kwh * 1000) / 1000, energyAmount, feesAmount, amount: energyAmount + feesAmount };
}
