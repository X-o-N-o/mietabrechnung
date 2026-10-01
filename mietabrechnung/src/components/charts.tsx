import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Report } from "@shared/types.ts";
import { formatEuro, formatEuroShort, monthLabel, monthShort } from "@/lib/format";
import { Dot } from "./ui";

const axis = { fontSize: 12, fill: "rgb(var(--subtle))" };

function TooltipBox({ title, rows, total }: { title: string; rows: { name: string; color: string; value: number }[]; total?: number }) {
  return (
    <div className="min-w-[180px] rounded-xl border border-line bg-raised/95 px-3 py-2.5 text-[13px] shadow-xl backdrop-blur">
      <p className="mb-1.5 font-medium">{title}</p>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-muted">
            <Dot color={r.color} className="h-2 w-2" />
            {r.name}
          </span>
          <span className="tnum">{formatEuro(r.value)}</span>
        </div>
      ))}
      {total !== undefined && rows.length > 1 && (
        <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-medium">
          <span>Summe</span>
          <span className="tnum">{formatEuro(total)}</span>
        </div>
      )}
    </div>
  );
}

/** Gestapelte Monatsbalken der Nebenkosten nach Kategorie. */
export function MonthlyCostsChart({ report, height = 260 }: { report: Report; height?: number }) {
  const cats = report.categories;
  const data = report.months.map((m) => ({
    month: m.month,
    total: m.costTotal,
    ...Object.fromEntries(cats.map((c) => [`c${c.id}`, m.byCategory[c.id] ?? 0])),
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 3" />
          <XAxis dataKey="month" tickFormatter={monthShort} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => formatEuroShort(v)} tick={axis} axisLine={false} tickLine={false} width={64} />
          <Tooltip
            cursor={{ fill: "rgb(var(--raised))", radius: 8 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={monthLabel(String(label))}
                  total={payload[0].payload.total}
                  rows={cats
                    .map((c) => ({ name: c.name, color: c.color, value: payload[0].payload[`c${c.id}`] as number }))
                    .filter((r) => r.value !== 0)}
                />
              ) : null
            }
          />
          {cats.map((c, i) => (
            <Bar
              key={c.id}
              dataKey={`c${c.id}`}
              stackId="a"
              fill={c.color}
              radius={i === cats.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ringdiagramm der Nebenkosten nach Kategorie, mit Legende. */
export function CategoryDonut({ report }: { report: Report }) {
  const data = [...report.categories].sort((a, b) => b.total - a.total);
  const total = data.reduce((s, c) => s + c.total, 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((c) => (
                <Cell key={c.id} fill={c.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(payload[0].name)}
                    rows={[{ name: "Betrag", color: String(payload[0].payload.color), value: Number(payload[0].value) }]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-subtle">Gesamt</span>
          <span className="text-lg font-semibold tnum">{formatEuroShort(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {data.map((c) => (
          <li key={c.id} className="flex items-center gap-3 text-sm">
            <Dot color={c.color} />
            <span className="flex-1 truncate text-muted">{c.name}</span>
            <span className="tnum text-subtle">{total ? Math.round((c.total / total) * 100) : 0} %</span>
            <span className="w-24 text-right font-medium tnum">{formatEuro(c.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
