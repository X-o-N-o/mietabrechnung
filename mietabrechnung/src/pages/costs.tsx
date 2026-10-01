import { useMemo, useState } from "react";
import { Pencil, Plus, Receipt, Repeat, Trash2, TrendingUp } from "lucide-react";
import type { Item } from "@shared/types.ts";
import { amountAt } from "@shared/calc.ts";
import { api, useApiMutation, useCategories, useItems, usePersons, useReport } from "@/lib/api";
import { currentMonth, formatEuro, intervalInfo, monthLabel } from "@/lib/format";
import { Badge, Button, Card, ConfirmButton, Dot, Empty, PageHeader, Stat } from "@/components/ui";
import { AmountDialog, ItemDialog } from "@/components/dialogs";
import { cn } from "@/lib/cn";

type Status = "active" | "planned" | "ended";

export default function CostsPage() {
  const now = currentMonth();
  const [category, setCategory] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; itemId?: number }>({ open: false });
  const [amountDialog, setAmountDialog] = useState<{ open: boolean; itemId?: number }>({ open: false });

  const { data: items = [], isLoading } = useItems();
  const { data: categories = [] } = useCategories();
  const { data: persons = [] } = usePersons();
  const { data: report } = useReport(now, now);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totalShares = persons.reduce((s, p) => s + p.shares, 0);
  const remove = useApiMutation((id: number) => api("DELETE", `items/${id}`), "Posten gelöscht");

  const status = (i: Item): Status => {
    if (i.startMonth > now) return "planned";
    if (i.interval === 0) return i.startMonth === now ? "active" : "ended";
    return i.endMonth && i.endMonth < now ? "ended" : "active";
  };

  const groups = useMemo(() => {
    const filtered = category === "all" ? items : items.filter((i) => String(i.categoryId) === category);
    const sorted = [...filtered].sort(
      (a, b) => (catById.get(a.categoryId)?.name ?? "").localeCompare(catById.get(b.categoryId)?.name ?? "") || a.id - b.id,
    );
    return (
      [
        ["active", "Laufend"],
        ["planned", "Geplant"],
        ["ended", "Beendet & einmalig"],
      ] as const
    )
      .map(([key, label]) => ({ key, label, items: sorted.filter((i) => status(i) === key) }))
      .filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, category, categories]);

  const monthTotal = report?.months[0]?.costTotal ?? 0;
  const editing = items.find((i) => i.id === dialog.itemId) ?? null;
  const changing = items.find((i) => i.id === amountDialog.itemId) ?? null;

  return (
    <>
      <PageHeader title="Nebenkosten" subtitle="Wiederkehrende Posten des ganzen Hauses – laufen automatisch weiter">
        <Button variant="primary" onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> Posten
        </Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={`Nebenkosten ${monthLabel(now)}`} value={formatEuro(monthTotal)} hint="ganzes Haus, Jahres- und Quartalsposten anteilig" />
        <Stat label="Je Anteil" value={formatEuro(totalShares ? Math.round(monthTotal / totalShares) : 0)} hint={`bei ${totalShares} Anteilen`} />
        <Stat
          className="col-span-2 lg:col-span-1"
          label="Laufende Posten"
          value={items.filter((i) => status(i) === "active" && i.interval !== 0).length}
          hint="werden jeden Monat automatisch berechnet"
        />
      </div>

      {categories.length > 0 && items.length > 0 && (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: "all", name: "Alle", color: "" }, ...categories.map((c) => ({ ...c, id: String(c.id) }))].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                category === c.id ? "border-accent/50 bg-accent/10 text-fg" : "border-line text-muted hover:text-fg",
              )}
            >
              {c.color && <Dot color={c.color} className="h-2 w-2" />}
              {c.name}
            </button>
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 ? (
        <Card>
          <Empty
            icon={<Repeat className="h-5 w-5" />}
            title="Noch keine Nebenkosten"
            text="Lege Posten wie Strom (monatlich), Müll (vierteljährlich) oder Grundsteuer (jährlich) einmal an – die App rechnet sie jeden Monat automatisch weiter."
            action={
              <Button variant="primary" onClick={() => setDialog({ open: true })}>
                <Plus className="h-4 w-4" /> Ersten Posten anlegen
              </Button>
            }
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <Empty icon={<Receipt className="h-5 w-5" />} title="Keine Posten in dieser Kategorie" />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-subtle">
                {g.label} <span className="ml-1 text-subtle/70">{g.items.length}</span>
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {g.items.map((i) => {
                    const cat = catById.get(i.categoryId);
                    const info = intervalInfo(i.interval);
                    const ref = g.key === "planned" ? i.startMonth : g.key === "ended" ? (i.endMonth ?? i.startMonth) : now;
                    const current = amountAt(i, ref);
                    const perMonth = i.interval > 0 ? Math.round(current / i.interval) : current;
                    const pendingChange = i.amounts.find((a) => a.validFrom > now && a.validFrom > i.startMonth);
                    return (
                      <li key={i.id} className={cn("group flex items-start gap-3 px-4 py-3.5 sm:items-center sm:px-5", g.key === "ended" && "opacity-70")}>
                        <Dot color={cat?.color ?? "#64748b"} className="mt-1.5 sm:mt-0" />
                        <button className="min-w-0 flex-1 text-left" onClick={() => setDialog({ open: true, itemId: i.id })}>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate text-sm font-medium">{cat?.name ?? "Unbekannt"}</p>
                            <p className="whitespace-nowrap text-sm font-semibold tnum">
                              {formatEuro(current)}
                              {info.per && <span className="font-normal text-subtle"> / {info.per}</span>}
                            </p>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <p className="flex min-w-0 items-center gap-2 text-xs text-subtle">
                              <Badge className="shrink-0">{info.label}</Badge>
                              <span className="truncate">
                                {[
                                  i.description,
                                  i.interval === 0
                                    ? monthLabel(i.startMonth)
                                    : `seit ${monthLabel(i.startMonth)}${i.endMonth ? ` bis ${monthLabel(i.endMonth)}` : ""}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </p>
                            <p className="whitespace-nowrap text-xs text-subtle tnum">
                              {i.interval > 1
                                ? `≈ ${formatEuro(perMonth)} / Monat`
                                : totalShares > 0
                                  ? `${formatEuro(Math.round(current / totalShares))} je Anteil`
                                  : ""}
                            </p>
                          </div>
                          {pendingChange && (
                            <p className="mt-1.5 text-xs font-medium text-accent">
                              Ab {monthLabel(pendingChange.validFrom)}: {formatEuro(pendingChange.amount)}
                            </p>
                          )}
                        </button>
                        <div className="hidden sm:flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                          {i.interval !== 0 && (
                            <Button variant="ghost" size="icon" aria-label="Betrag ändern" title="Betrag ändern" onClick={() => setAmountDialog({ open: true, itemId: i.id })}>
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => setDialog({ open: true, itemId: i.id })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ConfirmButton
                            variant="ghost"
                            size="icon"
                            aria-label="Löschen"
                            title="Posten löschen?"
                            description={`${cat?.name ?? "Der Posten"} wird mit allen Beträgen gelöscht – auch rückwirkend aus allen Abrechnungen. Wenn er nur nicht mehr anfällt, trage stattdessen ein Ende ein.`}
                            onConfirm={() => remove.mutate(i.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      <ItemDialog open={dialog.open} item={editing} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
      <AmountDialog open={amountDialog.open} item={changing} onOpenChange={(open) => setAmountDialog((d) => ({ ...d, open }))} />
    </>
  );
}
