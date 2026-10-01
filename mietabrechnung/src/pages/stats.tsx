import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { useCategories, useReport, useYears } from "@/lib/api";
import { formatEuro, percentChange } from "@/lib/format";
import { Avatar, Card, CardHeader, Delta, Dot, Empty, PageHeader, Stat, YearPicker } from "@/components/ui";
import { CategoryDonut, MonthlyCostsChart } from "@/components/charts";

export default function StatsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data: years = [] } = useYears();
  const { data: report } = useReport(`${year}-01`, `${year}-12`);
  const { data: prevReport } = useReport(`${year - 1}-01`, `${year - 1}-12`);
  const { data: categories = [] } = useCategories();

  const header = (
    <PageHeader title="Statistik" subtitle={`Auswertung der Nebenkosten ${year}`}>
      <YearPicker value={year} onChange={setYear} years={years} />
    </PageHeader>
  );
  if (!report || !prevReport) return header;

  const total = report.totals.costs;
  const prevTotal = prevReport.totals.costs;
  const monthsWithCosts = report.months.filter((m) => m.costTotal !== 0).length;
  const peak = report.months.reduce((a, b) => (b.costTotal > a.costTotal ? b : a), report.months[0]);

  // Vorjahresvergleich je Kategorie
  const prevByCat = new Map(prevReport.categories.map((c) => [c.id, c.total]));
  const curByCat = new Map(report.categories.map((c) => [c.id, c.total]));
  const comparison = categories
    .map((c) => ({ ...c, now: curByCat.get(c.id) ?? 0, before: prevByCat.get(c.id) ?? 0 }))
    .filter((c) => c.now !== 0 || c.before !== 0)
    .sort((a, b) => b.now - a.now);

  return (
    <>
      {header}
      {total === 0 && prevTotal === 0 ? (
        <Card>
          <Empty icon={<BarChart3 className="h-5 w-5" />} title={`Keine Daten für ${year}`} text="Sobald Nebenkosten erfasst sind, erscheinen hier die Auswertungen." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label={`Nebenkosten ${year}`}
              value={formatEuro(total)}
              hint={
                <>
                  <Delta value={percentChange(total, prevTotal)} /> zu {year - 1}
                </>
              }
            />
            <Stat
              label="Ø pro Monat"
              value={formatEuro(monthsWithCosts ? Math.round(total / monthsWithCosts) : 0)}
              hint={`über ${monthsWithCosts} Monat${monthsWithCosts === 1 ? "" : "e"} mit Kosten`}
            />
            <Stat label={`Vorjahr ${year - 1}`} value={formatEuro(prevTotal)} hint="Nebenkosten gesamt" />
            <Stat
              label="Mieteinnahmen"
              value={formatEuro(report.totals.rent)}
              hint={peak.costTotal ? `Teuerster Monat: ${new Date(`${peak.month}-01`).toLocaleDateString("de-DE", { month: "long" })}` : undefined}
            />
          </div>

          <Card className="mt-4">
            <CardHeader title="Nebenkosten pro Monat" subtitle={`Januar bis Dezember ${year}, gestapelt nach Kategorie`} />
            <div className="px-3 pb-4 pt-4 sm:px-5">
              <MonthlyCostsChart report={report} height={300} />
            </div>
          </Card>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Verteilung nach Kategorie" subtitle={`Anteil an den Nebenkosten ${year}`} />
              <div className="p-5">
                {report.categories.length ? <CategoryDonut report={report} /> : <p className="py-10 text-center text-sm text-muted">Keine Kosten in {year}</p>}
              </div>
            </Card>

            <Card>
              <CardHeader title="Vorjahresvergleich" subtitle={`${year} gegenüber ${year - 1}`} />
              <div className="overflow-x-auto px-5 pb-4 pt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[12px] uppercase tracking-wide text-subtle">
                      <th className="py-2 font-medium">Kategorie</th>
                      <th className="py-2 text-right font-medium">{year - 1}</th>
                      <th className="py-2 text-right font-medium">{year}</th>
                      <th className="py-2 text-right font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {comparison.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5">
                          <span className="flex items-center gap-2">
                            <Dot color={c.color} />
                            <span className="truncate">{c.name}</span>
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-muted tnum">{formatEuro(c.before)}</td>
                        <td className="py-2.5 text-right font-medium tnum">{formatEuro(c.now)}</td>
                        <td className="py-2.5 text-right">
                          <Delta value={percentChange(c.now, c.before)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line font-semibold">
                      <td className="pt-3">Gesamt</td>
                      <td className="pt-3 text-right tnum">{formatEuro(prevTotal)}</td>
                      <td className="pt-3 text-right tnum">{formatEuro(total)}</td>
                      <td className="pt-3 text-right">
                        <Delta value={percentChange(total, prevTotal)} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader title="Jahressumme je Person" subtitle="Miete und Nebenkosten-Anteil" />
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {report.persons.map((p) => {
                const a = report.totals.perPerson[p.id];
                return (
                  <div key={p.id} className="rounded-xl border border-line bg-bg/40 p-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.name} color={p.color} size="sm" />
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-auto text-xs text-subtle">{p.role === "tenant" ? "Mieter" : "Besitzer"}</span>
                    </div>
                    <p className="mt-3 text-xl font-semibold tnum">{formatEuro(a.total)}</p>
                    <p className="mt-1 text-xs text-subtle tnum">
                      {p.role === "tenant" ? `Miete ${formatEuro(a.rent)} · ` : ""}NK {formatEuro(a.costs)}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
