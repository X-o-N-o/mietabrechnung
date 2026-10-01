import { useEffect, useState } from "react";
import type { Cost, Rent } from "@shared/types.ts";
import { api, useApiMutation, useCategories, usePersons } from "@/lib/api";
import { centsToInput, currentMonth, formatEuro, parseEuro } from "@/lib/format";
import { Button, Dialog, Field, Input, Select } from "./ui";

// ---------- Nebenkostenposten ----------
export function CostDialog({
  open,
  onOpenChange,
  cost,
  defaultMonth,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cost?: Cost | null;
  defaultMonth?: string;
}) {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];
  const { data: persons = [] } = usePersons();
  const [form, setForm] = useState({ categoryId: "", month: "", amount: "", description: "", note: "" });

  // Formular nur beim Öffnen befüllen (bzw. sobald die Kategorien geladen sind)
  useEffect(() => {
    if (!open) return;
    const categories = categoriesData ?? [];
    setForm(
      cost
        ? {
            categoryId: String(cost.categoryId),
            month: cost.month,
            amount: centsToInput(cost.amount),
            description: cost.description,
            note: cost.note,
          }
        : { categoryId: String(categories[0]?.id ?? ""), month: defaultMonth ?? currentMonth(), amount: "", description: "", note: "" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cost, defaultMonth, !!categoriesData]);

  const amount = parseEuro(form.amount);
  const totalShares = persons.reduce((s, p) => s + p.shares, 0);
  const valid = amount !== null && !!form.categoryId && /^\d{4}-\d{2}$/.test(form.month);

  const save = useApiMutation(
    (body: object) => (cost ? api("PUT", `costs/${cost.id}`, body) : api("POST", "costs", body)),
    cost ? "Posten gespeichert" : "Posten hinzugefügt",
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      { categoryId: Number(form.categoryId), month: form.month, amount, description: form.description, note: form.note },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={cost ? "Posten bearbeiten" : "Nebenkosten erfassen"}
      description="Betrag für das ganze Haus. Er wird nach Anteilen auf alle Personen verteilt."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategorie">
            <Select value={form.categoryId} onChange={set("categoryId")}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Monat">
            <Input type="month" value={form.month} onChange={set("month")} required />
          </Field>
        </div>
        <Field
          label="Betrag (ganzes Haus)"
          hint={
            amount !== null && totalShares > 0 ? (
              <>
                ≈ <span className="tnum text-muted">{formatEuro(Math.round(amount / totalShares))}</span> je Anteil ({totalShares} Anteile)
              </>
            ) : (
              "z. B. 245,80"
            )
          }
        >
          <div className="relative">
            <Input
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={form.amount}
              onChange={set("amount")}
              className="pr-8 text-base tnum"
              aria-invalid={form.amount !== "" && amount === null}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">€</span>
          </div>
        </Field>
        <Field label="Beschreibung (optional)">
          <Input placeholder="z. B. Abschlag Stadtwerke" value={form.description} onChange={set("description")} />
        </Field>
        <Field label="Notiz (optional)">
          <Input placeholder="z. B. Rechnungsnummer" value={form.note} onChange={set("note")} />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || save.isPending}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------- Miete ----------
export function RentDialog({ open, onOpenChange, rent }: { open: boolean; onOpenChange: (o: boolean) => void; rent?: Rent | null }) {
  const { data: persons = [] } = usePersons();
  const tenants = persons.filter((p) => p.role === "tenant");
  const [form, setForm] = useState({ amount: "", validFrom: "", note: "" });

  useEffect(() => {
    if (!open) return;
    setForm(
      rent
        ? { amount: centsToInput(rent.amount), validFrom: rent.validFrom, note: rent.note }
        : { amount: "", validFrom: currentMonth(), note: "" },
    );
  }, [open, rent]);

  const amount = parseEuro(form.amount);
  const valid = amount !== null && amount >= 0 && /^\d{4}-\d{2}$/.test(form.validFrom);
  const save = useApiMutation(
    (body: object) => (rent ? api("PUT", `rents/${rent.id}`, body) : api("POST", "rents", body)),
    rent ? "Miete gespeichert" : "Miete hinzugefügt",
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (valid) save.mutate({ amount, validFrom: form.validFrom, note: form.note }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={rent ? "Miete bearbeiten" : "Neue Miete festlegen"}
      description="Gesamtmiete für alle Mieter zusammen. Sie gilt ab dem gewählten Monat, bis eine neue Miete eingetragen wird."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Gesamtmiete pro Monat"
          hint={
            amount !== null && tenants.length > 0 ? (
              <>
                = <span className="tnum text-muted">{formatEuro(Math.round(amount / tenants.length))}</span> je Mieter (
                {tenants.map((t) => t.name).join(", ")})
              </>
            ) : undefined
          }
        >
          <div className="relative">
            <Input
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="pr-8 text-base tnum"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">€</span>
          </div>
        </Field>
        <Field label="Gültig ab">
          <Input type="month" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} required />
        </Field>
        <Field label="Notiz (optional)">
          <Input placeholder="z. B. Mieterhöhung laut Vertrag" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || save.isPending}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
