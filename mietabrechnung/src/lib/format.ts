import { monthFromIndex, monthIndex } from "@shared/calc.ts";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const euroShort = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatEuro = (cents: number) => euro.format(cents / 100);
export const formatEuroShort = (cents: number) => euroShort.format(cents / 100);

/** Cent-Betrag als Eingabetext, z. B. 123456 → "1234,56" */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/**
 * Wandelt eine Eingabe wie "1.234,56", "1234,5", "12.50" oder "1 234 €" in Cent um.
 * Gibt null zurück, wenn die Eingabe keine Zahl ist.
 */
export function parseEuro(input: string): number | null {
  let s = input.replace(/[\s€]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
export const monthShort = (m: string) => MONTHS_SHORT[Number(m.slice(5, 7)) - 1];

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export const addMonths = (m: string, n: number) => monthFromIndex(monthIndex(m) + n);

export function percentChange(now: number, before: number): number | null {
  if (before === 0) return null;
  return ((now - before) / Math.abs(before)) * 100;
}

export const INTERVALS = [
  { value: 1, label: "Monatlich", per: "Monat" },
  { value: 3, label: "Vierteljährlich", per: "Quartal" },
  { value: 6, label: "Halbjährlich", per: "Halbjahr" },
  { value: 12, label: "Jährlich", per: "Jahr" },
  { value: 0, label: "Einmalig", per: "" },
] as const;
export const intervalInfo = (n: number) => INTERVALS.find((i) => i.value === n) ?? INTERVALS[0];
