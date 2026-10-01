import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { useReport, useYears } from "@/lib/api";
import { formatEuro, monthName } from "@/lib/format";
import { exportCsv, exportPdf } from "@/lib/export";
import { Avatar, Badge, Button, Card, CardHeader, Dot, Empty, PageHeader, YearPicker } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function SettlementPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const { data: years = [] } = useYears();
  const { data: report } = useReport(`${year}-01`, `${year}-12`);

  const header = (
    <PageHeader title="Endabrechnung" subtitle={`Jahresabrechnung ${year} für alle Personen`}>
      <YearPicker value={year} onChange={setYear} years={years} />
      {report && (
        <>
          <Button onClick={() => exportCsv(report, year)}>
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await exportPdf(report, year);
              } catch (e) {
                toast.error(`PDF konnte nicht erstellt werden: ${(e as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </>
      )}
    </PageHeader>
  );
  if (!report) return header;

  const persons = report.persons;
  const tenants = persons.filter((p) => p.role === "tenant");
  const empty = report.totals.costs === 0 && report.totals.rent === 0;

  return (
    <>
      {header}
      {empty ? (
        <Card>
          <Empty icon={<FileText className="h-5 w-5" />} title={`Keine Daten für ${year}`} text="Für dieses Jahr sind weder Miete noch Nebenkosten erfasst." />
        </Card>
      ) : (
        <>
          {/* Mieter-Zusammenfassung */}
          <div className="grid gap-4 sm:grid-cols-2">
            {tenants.map((t) => {
              const a = report.totals.perPerson[t.id];
              return (
                <Card key={t.id} className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} color={t.color} size="lg" />
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-[13px] text-muted">Jahresbetrag {year}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-[34px] font-semibold leading-none tracking-tight tnum">{formatEuro(a.total)}</p>
                  <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                    <Row label="Miete" value={a.rent} />
                    <Row label="Nebenkosten-Anteil" value={a.costs} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Aufteilung je Kategorie */}
          <Card className="mt-4">
            <CardHeader title="Aufteilung nach Kategorie" subtitle="Nebenkosten des ganzen Hauses, verteilt nach Anteilen" />
            <div className="overflow-x-auto px-5 pb-5 pt-3">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-[12px] uppercase tracking-wide text-subtle">
                    <th className="py-2 text-left font-medium">Kategorie</th>
                    <th className="py-2 text-right font-medium">Haus</th>
                    {persons.map((p) => (
                      <th key={p.id} className="py-2 text-right font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Dot color={p.color} className="h-2 w-2" />
                          {p.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.categories.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <Dot color={c.color} />
                          {c.name}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-medium tnum">{formatEuro(c.total)}</td>
                      {persons.map((p) => (
                        <td key={p.id} className="py-2.5 text-right text-muted tnum">
                          {formatEuro(c.perPerson[p.id] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <SumRow label="Summe Nebenkosten" house={report.totals.costs} values={persons.map((p) => report.totals.perPerson[p.id].costs)} />
                  <SumRow
                    label="Miete"
                    house={report.totals.rent}
                    values={persons.map((p) => (p.role === "tenant" ? report.totals.perPerson[p.id].rent : null))}
                  />
                  <SumRow
                    label="Gesamt"
                    strong
                    house={report.totals.costs + report.totals.rent}
                    values={persons.map((p) => report.totals.perPerson[p.id].total)}
                    owners={persons.map((p) => p.role === "owner")}
                  />
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Monatsübersicht */}
          <Card className="mt-4">
            <CardHeader title="Monatsübersicht" subtitle="Zu zahlender Betrag je Mieter und Monat" />
            <div className="overflow-x-auto px-5 pb-5 pt-3">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-[12px] uppercase tracking-wide text-subtle">
                    <th className="py-2 text-left font-medium">Monat</th>
                    <th className="py-2 text-right font-medium">Miete</th>
                    <th className="py-2 text-right font-medium">Nebenkosten</th>
                    {tenants.map((t) => (
                      <th key={t.id} className="py-2 text-right font-medium">
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.months.map((m) => (
                    <tr key={m.month} className={cn(m.rentTotal === 0 && m.costTotal === 0 && "text-subtle")}>
                      <td className="py-2.5">{monthName(m.month)}</td>
                      <td className="py-2.5 text-right text-muted tnum">{formatEuro(m.rentTotal)}</td>
                      <td className="py-2.5 text-right text-muted tnum">{formatEuro(m.costTotal)}</td>
                      {tenants.map((t) => (
                        <td key={t.id} className="py-2.5 text-right font-medium tnum">
                          {formatEuro(m.persons[t.id].total)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="pt-3">Summe</td>
                    <td className="pt-3 text-right tnum">{formatEuro(report.totals.rent)}</td>
                    <td className="pt-3 text-right tnum">{formatEuro(report.totals.costs)}</td>
                    {tenants.map((t) => (
                      <td key={t.id} className="pt-3 text-right tnum">
                        {formatEuro(report.totals.perPerson[t.id].total)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <p className="mt-4 text-xs text-subtle">
            <Badge className="mr-1.5">Hinweis</Badge>
            Die Anteile der Besitzer werden ausgewiesen, aber nicht in Rechnung gestellt. Rundungscents werden so verteilt, dass die
            Summe exakt stimmt.
          </p>
        </>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium tnum">{formatEuro(value)}</span>
    </div>
  );
}

function SumRow({
  label,
  house,
  values,
  strong,
  owners,
}: {
  label: string;
  house: number;
  values: (number | null)[];
  strong?: boolean;
  owners?: boolean[];
}) {
  return (
    <tr className={cn(strong ? "border-t-2 border-line font-semibold" : "border-t border-line font-medium")}>
      <td className="py-2.5">{label}</td>
      <td className="py-2.5 text-right tnum">{formatEuro(house)}</td>
      {values.map((v, i) => (
        <td key={i} className={cn("py-2.5 text-right tnum", owners?.[i] && "text-muted font-normal")}>
          {v === null ? <span className="text-subtle">–</span> : formatEuro(v)}
        </td>
      ))}
    </tr>
  );
}
