import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import type { Cost } from "@shared/types.ts";
import { api, useApiMutation, useCategories, useCosts, usePersons, useYears } from "@/lib/api";
import { currentMonth, formatEuro, monthLabel } from "@/lib/format";
import { Button, Card, ConfirmButton, Dialog, Dot, Empty, Field, Input, PageHeader, YearPicker } from "@/components/ui";
import { CostDialog } from "@/components/dialogs";

export default function CostsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [category, setCategory] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; cost?: Cost | null; month?: string }>({ open: false });
  const [copyOpen, setCopyOpen] = useState(false);

  const { data: years = [] } = useYears();
  const { data: costs = [], isLoading } = useCosts(year);
  const { data: categories = [] } = useCategories();
  const { data: persons = [] } = usePersons();
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totalShares = persons.reduce((s, p) => s + p.shares, 0);

  const remove = useApiMutation((id: number) => api("DELETE", `costs/${id}`), "Posten gelöscht");

  const groups = useMemo(() => {
    const filtered = category === "all" ? costs : costs.filter((c) => String(c.categoryId) === category);
    const map = new Map<string, Cost[]>();
    for (const c of filtered) map.set(c.month, [...(map.get(c.month) ?? []), c]);
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [costs, category]);

  const yearTotal = groups.reduce((s, [, items]) => s + items.reduce((t, c) => t + c.amount, 0), 0);

  return (
    <>
      <PageHeader title="Nebenkosten" subtitle={`${formatEuro(yearTotal)} im Jahr ${year}`}>
        <YearPicker value={year} onChange={setYear} years={years} />
        <Button onClick={() => setCopyOpen(true)}>
          <Copy className="h-4 w-4" />
          <span className="hidden sm:inline">Vormonat übernehmen</span>
        </Button>
        <Button variant="primary" onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> Posten
        </Button>
      </PageHeader>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ id: "all", name: "Alle", color: "" }, ...categories.map((c) => ({ ...c, id: String(c.id) }))].map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              category === c.id ? "border-accent/50 bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"
            }`}
          >
            {c.color && <Dot color={c.color} className="h-2 w-2" />}
            {c.name}
          </button>
        ))}
      </div>

      {!isLoading && groups.length === 0 ? (
        <Card>
          <Empty
            icon={<Receipt className="h-5 w-5" />}
            title={`Keine Nebenkosten in ${year}`}
            text="Erfasse Posten wie Strom, Wasser oder Müll für das ganze Haus. Die Aufteilung passiert automatisch."
            action={
              <Button variant="primary" onClick={() => setDialog({ open: true })}>
                <Plus className="h-4 w-4" /> Ersten Posten erfassen
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([month, items]) => {
            const sum = items.reduce((s, c) => s + c.amount, 0);
            return (
              <Card key={month} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-raised/40 px-5 py-3">
                  <p className="font-semibold tracking-tight">{monthLabel(month)}</p>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-[13px] text-muted sm:inline tnum">
                      je Anteil {formatEuro(totalShares ? Math.round(sum / totalShares) : 0)}
                    </span>
                    <span className="font-semibold tnum">{formatEuro(sum)}</span>
                    <Button variant="ghost" size="icon" aria-label="Posten in diesem Monat hinzufügen" onClick={() => setDialog({ open: true, month })}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ul className="divide-y divide-line">
                  {items.map((c) => {
                    const cat = catById.get(c.categoryId);
                    return (
                      <li key={c.id} className="group flex items-center gap-3 px-5 py-3">
                        <Dot color={cat?.color ?? "#64748b"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cat?.name ?? "Unbekannt"}</p>
                          {(c.description || c.note) && (
                            <p className="truncate text-xs text-subtle">{[c.description, c.note].filter(Boolean).join(" · ")}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium tnum">{formatEuro(c.amount)}</span>
                        <div className="flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                          <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => setDialog({ open: true, cost: c })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ConfirmButton
                            variant="ghost"
                            size="icon"
                            aria-label="Löschen"
                            title="Posten löschen?"
                            description={`${cat?.name ?? "Posten"} über ${formatEuro(c.amount)} in ${monthLabel(c.month)} wird endgültig gelöscht.`}
                            onConfirm={() => remove.mutate(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <CostDialog
        open={dialog.open}
        cost={dialog.cost}
        defaultMonth={dialog.month}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <CopyPreviousDialog open={copyOpen} onOpenChange={setCopyOpen} />
    </>
  );
}

function CopyPreviousDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [month, setMonth] = useState(currentMonth);
  const copy = useApiMutation((m: string) => api<{ copied: number }>("POST", "costs/copy-previous", { month: m }));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Vormonat übernehmen"
      description="Kopiert alle Posten des Vormonats in den gewählten Monat. Beträge kannst du danach anpassen."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            variant="primary"
            disabled={copy.isPending}
            onClick={() =>
              copy.mutate(month, {
                onSuccess: (r) => {
                  onOpenChange(false);
                  toast.success(`${r.copied} Posten übernommen`);
                },
              })
            }
          >
            Übernehmen
          </Button>
        </>
      }
    >
      <Field label="Zielmonat">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
    </Dialog>
  );
}
