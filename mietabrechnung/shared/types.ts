// Alle Beträge sind ganze Cent-Beträge (integer), Monate im Format "YYYY-MM".

export type Role = "owner" | "tenant";

export interface Person {
  id: number;
  name: string;
  role: Role;
  shares: number;
  color: string;
  sort: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Rent {
  id: number;
  amount: number; // Gesamtmiete für alle Mieter zusammen
  validFrom: string; // YYYY-MM
  note: string;
}

/** Turnus in Monaten; 0 = einmalig */
export type Interval = 0 | 1 | 3 | 6 | 12;

export interface ItemAmount {
  id: number;
  validFrom: string; // YYYY-MM, gilt bis zur nächsten Änderung
  amount: number; // Betrag je Fälligkeit (z. B. pro Quartal)
}

/** Wiederkehrender (oder einmaliger) Nebenkostenposten des ganzen Hauses */
export interface Item {
  id: number;
  categoryId: number;
  description: string;
  note: string;
  interval: Interval;
  startMonth: string; // erste Fälligkeit
  endMonth: string | null; // letzter berechneter Monat (einschließlich)
  amounts: ItemAmount[]; // aufsteigend nach validFrom
}

/** Auf einen Monat entfallender Anteil eines Postens */
export interface Charge {
  itemId: number;
  categoryId: number;
  month: string;
  amount: number;
}

export interface PersonAmounts {
  rent: number;
  costs: number;
  total: number;
}

export interface MonthReport {
  month: string;
  rentTotal: number;
  costTotal: number;
  byCategory: Record<number, number>;
  byItem: Record<number, number>;
  persons: Record<number, PersonAmounts>;
}

export interface CategoryReport {
  id: number;
  name: string;
  color: string;
  total: number;
  perPerson: Record<number, number>;
}

export interface Report {
  from: string;
  to: string;
  persons: Person[];
  months: MonthReport[];
  categories: CategoryReport[];
  totals: { rent: number; costs: number; perPerson: Record<number, PersonAmounts> };
}
