import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Item, Rent } from "@shared/types.ts";
import { amountAt } from "@shared/calc.ts";
import { api, useApiMutation, useCategories, usePersons } from "@/lib/api";
import { INTERVALS, centsToInput, currentMonth, formatEuro, intervalInfo, monthLabel, parseEuro } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button, ConfirmButton, Dialog, Field, Input, Select } from "./ui";

function EuroInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0,00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-8 text-base tnum"
        aria-invalid={value !== "" && parseEuro(value) === null}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">€</span>
    </div>
  );
}

/** Hinweis, was ein Betrag pro Monat und je Anteil bedeutet. */
function useSplitHint(amount: number | null, interval: number): ReactNode {
  const { data: persons = [] } = usePersons();
  const shares = persons.reduce((s, p) => s + p.shares, 0);
  if (amount === null || shares === 0) return undefined;
  if (interval <= 1) {
    return (
      <>
        <span className="tnum text-muted">{formatEuro(Math.round(amount / shares))}</span> je Anteil{interval === 1 ? " und Monat" : ""} ({shares} Anteile)
      </>
    );
  }
  const perMonth = Math.round(amount / interval);
  return (
    <>
      verteilt auf {interval} Monate: <span className="tnum text-muted">{formatEuro(perMonth)}</span> pro Monat ·{" "}
      <span className="tnum text-muted">{formatEuro(Math.round(perMonth / shares))}</span> je Anteil
    </>
  );
}

function IntervalPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {INTERVALS.map((i) => (
        <button
          key={i.value}
          type="button"
          onClick={() => onChange(i.value)}
          className={cn(
            "h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors",
            value === i.value ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:text-fg",
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

const MONTH_RE = /^\d{4}-\d{2}$/;

// ---------- Nebenkostenposten ----------
export function ItemDialog({
  open,
  onOpenChange,
  item,
  defaultMonth,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item?: Item | null;
  defaultMonth?: string;
}) {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];
  const [form, setForm] = useState({ categoryId: "", interval: 1, startMonth: "", endMonth: "", amount: "", description: "", note: "" });
  const [newAmount, setNewAmount] = useState({ validFrom: "", amount: "" });

  // Formular nur beim Öffnen befüllen (bzw. sobald die Kategorien geladen sind)
  useEffect(() => {
    if (!open) return;
    const categories = categoriesData ?? [];
    setForm(
      item
        ? {
            categoryId: String(item.categoryId),
            interval: item.interval,
            startMonth: item.startMonth,
            endMonth: item.endMonth ?? "",
            amount: "",
            description: item.description,
            note: item.note,
          }
        : { categoryId: String(categories[0]?.id ?? ""), interval: 1, startMonth: defaultMonth ?? currentMonth(), endMonth: "", amount: "", description: "", note: "" },
    );
    setNewAmount({ validFrom: currentMonth(), amount: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, defaultMonth, !!categoriesData]);

  const amount = parseEuro(form.amount);
  const hint = useSplitHint(item ? amountAt(item, currentMonth()) : amount, form.interval);
  const valid =
    !!form.categoryId &&
    MONTH_RE.test(form.startMonth) &&
    (!form.endMonth || form.endMonth >= form.startMonth) &&
    (item ? true : amount !== null);

  const save = useApiMutation(
    (body: object) => (item ? api("PUT", `items/${item.id}`, body) : api("POST", "items", body)),
    item ? "Posten gespeichert" : "Posten angelegt",
  );
  const addAmount = useApiMutation((b: { validFrom: string; amount: number }) => api("POST", `items/${item!.id}/amounts`, b), "Betrag gespeichert");
  const removeAmount = useApiMutation((aid: number) => api("DELETE", `items/${item!.id}/amounts/${aid}`), "Betrag entfernt");
  const removeItem = useApiMutation(() => api("DELETE", `items/${item!.id}`), "Posten gelöscht");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      {
        categoryId: Number(form.categoryId),
        interval: form.interval,
        startMonth: form.startMonth,
        endMonth: form.endMonth || null,
        amount,
        description: form.description,
        note: form.note,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const per = intervalInfo(form.interval).per;
  const newAmountCents = parseEuro(newAmount.amount);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Posten bearbeiten" : "Nebenkostenposten anlegen"}
      description={item ? undefined : "Einmal anlegen, die App rechnet ihn jeden Monat weiter, bis du den Betrag änderst oder den Posten beendest."}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Kategorie">
          <Select value={form.categoryId} onChange={set("categoryId")}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Turnus">
          <IntervalPicker value={form.interval} onChange={(interval) => setForm((f) => ({ ...f, interval }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={form.interval === 0 ? "Monat" : "Erste Fälligkeit"}>
            <Input type="month" value={form.startMonth} onChange={set("startMonth")} required />
          </Field>
          {form.interval !== 0 && (
            <Field label="Ende (optional)" hint="leer = läuft weiter">
              <Input type="month" value={form.endMonth} min={form.startMonth} onChange={set("endMonth")} />
            </Field>
          )}
        </div>
        {!item && (
          <Field label={form.interval === 0 ? "Betrag (ganzes Haus)" : `Betrag je ${per} (ganzes Haus)`} hint={hint ?? "z. B. 245,80"}>
            <EuroInput autoFocus value={form.amount} onChange={(amount) => setForm((f) => ({ ...f, amount }))} />
          </Field>
        )}
        <Field label="Beschreibung (optional)">
          <Input placeholder="z. B. Abschlag Stadtwerke" value={form.description} onChange={set("description")} />
        </Field>
        <Field label="Notiz (optional)">
          <Input placeholder="z. B. Vertragsnummer" value={form.note} onChange={set("note")} />
        </Field>

        {item && (
          <div className="rounded-xl border border-line bg-bg/40 p-3">
            <p className="mb-2 text-[13px] font-medium text-muted">Beträge{per ? ` je ${per}` : ""}</p>
            <ul className="space-y-1">
              {[...item.amounts].reverse().map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-raised/60">
                  <span className="flex-1 text-muted">ab {monthLabel(a.validFrom)}</span>
                  <span className="font-medium tnum">{formatEuro(a.amount)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Betrag entfernen"
                    disabled={item.amounts.length <= 1}
                    onClick={() => removeAmount.mutate(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            {item.interval !== 0 && (
              <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
                <Field label="Neu ab" className="w-[150px] shrink-0">
                  <Input type="month" value={newAmount.validFrom} onChange={(e) => setNewAmount((n) => ({ ...n, validFrom: e.target.value }))} />
                </Field>
                <Field label="Betrag" className="flex-1">
                  <EuroInput value={newAmount.amount} onChange={(amount) => setNewAmount((n) => ({ ...n, amount }))} />
                </Field>
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Betrag hinzufügen"
                  disabled={newAmountCents === null || !MONTH_RE.test(newAmount.validFrom) || addAmount.isPending}
                  onClick={() =>
                    addAmount.mutate(
                      { validFrom: newAmount.validFrom, amount: newAmountCents! },
                      { onSuccess: () => setNewAmount((n) => ({ ...n, amount: "" })) },
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          {item && (
            <ConfirmButton
              type="button"
              variant="danger"
              className="sm:mr-auto"
              title="Posten löschen?"
              description="Der Posten wird mit allen Beträgen gelöscht – auch rückwirkend aus allen Abrechnungen. Wenn er nur nicht mehr anfällt, trage stattdessen ein Ende ein."
              onConfirm={() => removeItem.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
            >
              <Trash2 className="h-4 w-4" /> Löschen
            </ConfirmButton>
          )}
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

/** Schnellaktion: neuer Betrag ab einem Monat */
export function AmountDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: Item | null }) {
  const [form, setForm] = useState({ validFrom: "", amount: "" });
  useEffect(() => {
    if (open && item) setForm({ validFrom: currentMonth(), amount: centsToInput(amountAt(item, currentMonth())) });
  }, [open, item]);

  const amount = parseEuro(form.amount);
  const hint = useSplitHint(amount, item?.interval ?? 1);
  const save = useApiMutation((b: object) => api("POST", `items/${item!.id}/amounts`, b), "Betrag geändert");
  if (!item) return null;
  const per = intervalInfo(item.interval).per;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Betrag ändern"
      description={
        item.interval > 1
          ? `Der neue Betrag gilt ab der ersten Fälligkeit (${per}) ab dem gewählten Monat, bis du ihn wieder änderst.`
          : "Der neue Betrag gilt ab dem gewählten Monat, bis du ihn wieder änderst."
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount !== null && MONTH_RE.test(form.validFrom))
            save.mutate({ validFrom: form.validFrom, amount }, { onSuccess: () => onOpenChange(false) });
        }}
      >
        <Field label="Gültig ab">
          <Input type="month" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
        </Field>
        <Field label={`Neuer Betrag je ${per} (ganzes Haus)`} hint={hint}>
          <EuroInput autoFocus value={form.amount} onChange={(amount) => setForm((f) => ({ ...f, amount }))} />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={amount === null || save.isPending}>
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
