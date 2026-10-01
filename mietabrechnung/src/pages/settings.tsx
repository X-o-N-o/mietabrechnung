import { useEffect, useState } from "react";
import { Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import type { Category, Person, Role } from "@shared/types.ts";
import { api, useApiMutation, useCategories, usePersons } from "@/lib/api";
import { useTheme } from "@/components/layout";
import { Avatar, Badge, Button, Card, CardHeader, ColorPicker, ConfirmButton, Dialog, Dot, Field, Input, PRESET_COLORS, PageHeader, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function SettingsPage() {
  const { data: persons = [] } = usePersons();
  const { data: categories = [] } = useCategories();
  const [dark, setDark] = useTheme();
  const [personDialog, setPersonDialog] = useState<{ open: boolean; person?: Person | null }>({ open: false });
  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: Category | null }>({ open: false });

  const removePerson = useApiMutation((id: number) => api("DELETE", `persons/${id}`), "Person entfernt");
  const removeCategory = useApiMutation((id: number) => api("DELETE", `categories/${id}`), "Kategorie gelöscht");
  const totalShares = persons.reduce((s, p) => s + p.shares, 0);

  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Personen, Anteile und Kategorien" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Personen"
            subtitle={`Nebenkosten werden durch ${totalShares} Anteile geteilt`}
            action={
              <Button size="sm" onClick={() => setPersonDialog({ open: true })}>
                <Plus className="h-3.5 w-3.5" /> Person
              </Button>
            }
          />
          <ul className="px-2 pb-2 pt-3">
            {persons.map((p) => (
              <li key={p.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-raised/50">
                <Avatar name={p.name} color={p.color} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {p.name}
                    <Badge className={cn(p.role === "tenant" && "bg-accent/15 text-accent")}>{p.role === "tenant" ? "Mieter" : "Besitzer"}</Badge>
                  </p>
                  <p className="text-xs text-subtle">
                    {p.shares} Anteil{p.shares === 1 ? "" : "e"} · {totalShares ? Math.round((p.shares / totalShares) * 1000) / 10 : 0} % der Nebenkosten
                  </p>
                </div>
                <div className="flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => setPersonDialog({ open: true, person: p })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="icon"
                    aria-label="Entfernen"
                    title={`${p.name} entfernen?`}
                    description="Die Aufteilung aller Monate wird danach ohne diese Person neu berechnet – auch rückwirkend."
                    confirmLabel="Entfernen"
                    onConfirm={() => removePerson.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Kategorien"
            subtitle="Für die Zuordnung der Nebenkosten"
            action={
              <Button size="sm" onClick={() => setCatDialog({ open: true })}>
                <Plus className="h-3.5 w-3.5" /> Kategorie
              </Button>
            }
          />
          <ul className="px-2 pb-2 pt-3">
            {categories.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-raised/50">
                <Dot color={c.color} />
                <span className="flex-1 truncate text-sm">{c.name}</span>
                <div className="flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => setCatDialog({ open: true, category: c })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="icon"
                    aria-label="Löschen"
                    title={`Kategorie „${c.name}“ löschen?`}
                    description="Das geht nur, wenn keine Posten mehr dieser Kategorie zugeordnet sind."
                    onConfirm={() => removeCategory.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold tracking-tight">Darstellung</p>
              <p className="mt-0.5 text-[13px] text-muted">Wird in diesem Browser gespeichert</p>
            </div>
            <div className="flex rounded-xl border border-line bg-bg p-1">
              {[
                { v: true, label: "Dunkel", icon: Moon },
                { v: false, label: "Hell", icon: Sun },
              ].map(({ v, label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => setDark(v)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                    dark === v ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <PersonDialog open={personDialog.open} person={personDialog.person} onOpenChange={(open) => setPersonDialog((d) => ({ ...d, open }))} />
      <CategoryDialog open={catDialog.open} category={catDialog.category} onOpenChange={(open) => setCatDialog((d) => ({ ...d, open }))} />
    </>
  );
}

function PersonDialog({ open, onOpenChange, person }: { open: boolean; onOpenChange: (o: boolean) => void; person?: Person | null }) {
  const [form, setForm] = useState({ name: "", role: "tenant" as Role, shares: "1", color: PRESET_COLORS[0] });
  useEffect(() => {
    if (open)
      setForm(
        person
          ? { name: person.name, role: person.role, shares: String(person.shares), color: person.color }
          : { name: "", role: "tenant", shares: "1", color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] },
      );
  }, [open, person]);

  const shares = Number(form.shares);
  const valid = form.name.trim() && Number.isInteger(shares) && shares >= 0;
  const save = useApiMutation(
    (body: object) => (person ? api("PUT", `persons/${person.id}`, body) : api("POST", "persons", body)),
    person ? "Person gespeichert" : "Person angelegt",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={person ? "Person bearbeiten" : "Person anlegen"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate({ ...form, shares }, { onSuccess: () => onOpenChange(false) });
        }}
      >
        <Field label="Name">
          <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rolle" hint={form.role === "tenant" ? "zahlt Miete + Anteil" : "Anteil wird nur ausgewiesen"}>
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              <option value="tenant">Mieter</option>
              <option value="owner">Besitzer</option>
            </Select>
          </Field>
          <Field label="Anteile" hint="Standard: 1">
            <Input type="number" min={0} step={1} value={form.shares} onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))} />
          </Field>
        </div>
        <Field label="Farbe">
          <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
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

function CategoryDialog({ open, onOpenChange, category }: { open: boolean; onOpenChange: (o: boolean) => void; category?: Category | null }) {
  const [form, setForm] = useState({ name: "", color: PRESET_COLORS[0] });
  useEffect(() => {
    if (open) setForm(category ? { name: category.name, color: category.color } : { name: "", color: PRESET_COLORS[4] });
  }, [open, category]);

  const save = useApiMutation(
    (body: object) => (category ? api("PUT", `categories/${category.id}`, body) : api("POST", "categories", body)),
    category ? "Kategorie gespeichert" : "Kategorie angelegt",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={category ? "Kategorie bearbeiten" : "Kategorie anlegen"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.trim()) save.mutate(form, { onSuccess: () => onOpenChange(false) });
        }}
      >
        <Field label="Name">
          <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Farbe">
          <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={!form.name.trim() || save.isPending}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
