import { useState } from "react";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import type { Rent } from "@shared/types.ts";
import { rentForMonth, splitCents } from "@shared/calc.ts";
import { api, useApiMutation, usePersons, useRents } from "@/lib/api";
import { currentMonth, formatEuro, monthLabel } from "@/lib/format";
import { Avatar, Badge, Button, Card, CardHeader, ConfirmButton, Empty, PageHeader } from "@/components/ui";
import { RentDialog } from "@/components/dialogs";

export default function RentPage() {
  const [dialog, setDialog] = useState<{ open: boolean; rent?: Rent | null }>({ open: false });
  const { data: rents = [], isLoading } = useRents();
  const { data: persons = [] } = usePersons();
  const tenants = persons.filter((p) => p.role === "tenant");
  const remove = useApiMutation((id: number) => api("DELETE", `rents/${id}`), "Mieteintrag gelöscht");

  const now = currentMonth();
  const current = rentForMonth(rents, now);
  const currentSplit = splitCents(current, tenants.map(() => 1));
  const activeId = [...rents].reverse().find((r) => r.validFrom <= now)?.id;
  const history = [...rents].reverse();

  return (
    <>
      <PageHeader title="Miete" subtitle="Gesamtmiete beider Mieter, zu gleichen Teilen aufgeteilt">
        <Button variant="primary" onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> Neue Miete
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden p-6 md:col-span-1">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <p className="text-[13px] font-medium text-muted">Aktuelle Gesamtmiete</p>
          <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight tnum">{formatEuro(current)}</p>
          <p className="mt-2 text-[13px] text-subtle">pro Monat · Stand {monthLabel(now)}</p>
        </Card>
        {tenants.map((t, i) => (
          <Card key={t.id} className="p-6">
            <div className="flex items-center gap-3">
              <Avatar name={t.name} color={t.color} />
              <p className="font-medium">{t.name}</p>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight tnum">{formatEuro(currentSplit[i] ?? 0)}</p>
            <p className="mt-1 text-[13px] text-subtle">
              Anteil an der Miete ({tenants.length > 0 ? `1/${tenants.length}` : "–"})
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader title="Verlauf" subtitle="Eine Miete gilt ab ihrem Monat, bis eine neue eingetragen wird" />
        <div className="px-2 pb-2 pt-3">
          {!isLoading && history.length === 0 ? (
            <Empty
              icon={<KeyRound className="h-5 w-5" />}
              title="Noch keine Miete festgelegt"
              text="Trage die Gesamtmiete für beide Mieter ein. Bei einer Mieterhöhung legst du einfach einen neuen Eintrag mit neuem Startmonat an."
              action={
                <Button variant="primary" onClick={() => setDialog({ open: true })}>
                  <Plus className="h-4 w-4" /> Miete festlegen
                </Button>
              }
            />
          ) : (
            <ul>
              {history.map((r) => (
                <li key={r.id} className="group flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-raised/50">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      ab {monthLabel(r.validFrom)}
                      {r.id === activeId && <Badge className="bg-accent/15 text-accent">aktuell</Badge>}
                      {r.validFrom > now && <Badge>geplant</Badge>}
                    </p>
                    {r.note && <p className="truncate text-xs text-subtle">{r.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tnum">{formatEuro(r.amount)}</p>
                    {tenants.length > 0 && (
                      <p className="text-xs text-subtle tnum">je {formatEuro(Math.round(r.amount / tenants.length))}</p>
                    )}
                  </div>
                  <div className="flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => setDialog({ open: true, rent: r })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      size="icon"
                      aria-label="Löschen"
                      title="Mieteintrag löschen?"
                      description={`Die Miete von ${formatEuro(r.amount)} ab ${monthLabel(r.validFrom)} wird gelöscht. Für diesen Zeitraum gilt dann wieder die vorherige Miete.`}
                      onConfirm={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <RentDialog open={dialog.open} rent={dialog.rent} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </>
  );
}
