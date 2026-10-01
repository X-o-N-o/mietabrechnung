import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, KeyRound, Plus, Receipt } from "lucide-react";
import type { Cost } from "@shared/types.ts";
import { useCategories, useCosts, useReport } from "@/lib/api";
import { addMonths, currentMonth, formatEuro, monthLabel, percentChange } from "@/lib/format";
import { Avatar, Badge, Button, Card, CardHeader, Delta, Dot, Empty, MonthPicker, PageHeader, Stat } from "@/components/ui";
import { CostDialog } from "@/components/dialogs";
import { MonthlyCostsChart } from "@/components/charts";

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [dialog, setDialog] = useState<{ open: boolean; cost?: Cost | null }>({ open: false });
  const { data: report } = useReport(addMonths(month, -11), month);
  const { data: costs = [] } = useCosts(Number(month.slice(0, 4)));
  const { data: categories = [] } = useCategories();

  if (!report) return <PageHeader title="Übersicht" />;

  const cur = report.months[report.months.length - 1];
  const prev = report.months[report.months.length - 2];
  const tenants = report.persons.filter((p) => p.role === "tenant");
  const owners = report.persons.filter((p) => p.role === "owner");
  const totalShares = report.persons.reduce((s, p) => s + p.shares, 0);
  const monthCosts = costs.filter((c) => c.month === month);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const avg12 = Math.round(report.totals.costs / 12);

  return (
    <>
      <PageHeader title="Übersicht" subtitle={`Abrechnung für ${monthLabel(month)}`}>
        <MonthPicker value={month} onChange={setMonth} />
        <Button variant="primary" onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nebenkosten</span>
        </Button>
      </PageHeader>

      {/* Mieter-Karten */}
      <div className="grid gap-4 sm:grid-cols-2">
        {tenants.map((t) => {
          const a = cur.persons[t.id];
          return (
            <Card key={t.id} className="relative overflow-hidden p-5 sm:p-6">
              <div
                className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-20 blur-3xl"
                style={{ backgroundColor: t.color }}
              />
              <div className="flex items-center gap-3">
                <Avatar name={t.name} color={t.color} size="lg" />
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-[13px] text-muted">Mieter · zahlt für {monthLabel(month)}</p>
                </div>
              </div>
              <p className="mt-5 text-[34px] font-semibold leading-none tracking-tight tnum">{formatEuro(a.total)}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <p className="text-[13px] text-muted">Miete</p>
                  <p className="mt-0.5 font-medium tnum">{formatEuro(a.rent)}</p>
                </div>
                <div>
                  <p className="text-[13px] text-muted">Nebenkosten-Anteil</p>
                  <p className="mt-0.5 font-medium tnum">{formatEuro(a.costs)}</p>
                </div>
              </div>
            </Card>
          );
        })}
        {tenants.length === 0 && (
          <Card className="sm:col-span-2">
            <Empty
              icon={<KeyRound className="h-5 w-5" />}
              title="Keine Mieter angelegt"
              text="Lege in den Einstellungen Personen mit der Rolle „Mieter“ an."
              action={
                <Link href="/einstellungen">
                  <Button>Zu den Einstellungen</Button>
                </Link>
              }
            />
          </Card>
        )}
      </div>

      {/* Kennzahlen */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Nebenkosten Haus"
          value={formatEuro(cur.costTotal)}
          hint={
            <>
              <Delta value={percentChange(cur.costTotal, prev?.costTotal ?? 0)} /> zum Vormonat
            </>
          }
        />
        <Stat
          label="Je Anteil"
          value={formatEuro(totalShares ? Math.round(cur.costTotal / totalShares) : 0)}
          hint={`${totalShares} Anteile im Haus`}
        />
        <Stat label="Gesamtmiete" value={formatEuro(cur.rentTotal)} hint={cur.rentTotal ? "für alle Mieter" : <Link href="/miete" className="text-accent">Miete festlegen →</Link>} />
        <Stat label="Ø Nebenkosten" value={formatEuro(avg12)} hint="pro Monat, letzte 12 Monate" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Verlauf */}
        <Card className="lg:col-span-3">
          <CardHeader title="Nebenkosten-Verlauf" subtitle="Letzte 12 Monate nach Kategorie" />
          <div className="px-3 pb-4 pt-4 sm:px-5">
            {report.totals.costs ? (
              <MonthlyCostsChart report={report} />
            ) : (
              <Empty icon={<Receipt className="h-5 w-5" />} title="Noch keine Daten" text="Sobald Nebenkosten erfasst sind, erscheint hier der Verlauf." />
            )}
          </div>
        </Card>

        {/* Posten des Monats */}
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader
            title="Posten im Monat"
            subtitle={`${monthCosts.length} Posten · ${formatEuro(cur.costTotal)}`}
            action={
              <Link href="/nebenkosten" className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                Alle <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="flex-1 px-2 pb-3 pt-3">
            {monthCosts.length === 0 ? (
              <Empty
                icon={<Receipt className="h-5 w-5" />}
                title="Keine Posten"
                text={`Für ${monthLabel(month)} sind noch keine Nebenkosten erfasst.`}
                action={
                  <Button size="sm" onClick={() => setDialog({ open: true })}>
                    <Plus className="h-3.5 w-3.5" /> Erfassen
                  </Button>
                }
              />
            ) : (
              <ul>
                {monthCosts.map((c) => {
                  const cat = catById.get(c.categoryId);
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setDialog({ open: true, cost: c })}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-raised"
                      >
                        <Dot color={cat?.color ?? "#64748b"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cat?.name ?? "Unbekannt"}</p>
                          {c.description && <p className="truncate text-xs text-subtle">{c.description}</p>}
                        </div>
                        <span className="text-sm font-medium tnum">{formatEuro(c.amount)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Besitzer */}
      {owners.length > 0 && (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold tracking-tight">Anteile der Besitzer</p>
              <p className="mt-0.5 text-[13px] text-muted">Werden ausgewiesen, aber nicht in Rechnung gestellt</p>
            </div>
            <div className="flex flex-wrap gap-6">
              {owners.map((o) => (
                <div key={o.id} className="flex items-center gap-3">
                  <Avatar name={o.name} color={o.color} />
                  <div>
                    <p className="text-sm font-medium">
                      {o.name} <Badge className="ml-1">Besitzer</Badge>
                    </p>
                    <p className="text-sm text-muted tnum">{formatEuro(cur.persons[o.id].costs)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <CostDialog open={dialog.open} cost={dialog.cost} defaultMonth={month} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </>
  );
}
