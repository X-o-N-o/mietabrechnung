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

export interface Cost {
  id: number;
  categoryId: number;
  description: string;
  amount: number;
  month: string; // YYYY-MM, Monat, dem der Posten zugeordnet wird
  note: string;
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
