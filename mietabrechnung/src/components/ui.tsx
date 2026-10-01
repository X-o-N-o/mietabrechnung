import * as RDialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { addMonths, monthLabel } from "@/lib/format";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110 shadow-[0_0_0_1px_rgb(var(--accent)/0.4),0_8px_24px_-8px_rgb(var(--accent)/0.5)]",
  secondary: "bg-raised text-fg border border-line hover:bg-line/60",
  ghost: "text-muted hover:text-fg hover:bg-raised",
  danger: "bg-danger/10 text-danger hover:bg-danger/20",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "icon" }
>(({ className, variant = "secondary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
      size === "md" && "h-10 px-4 text-sm",
      size === "sm" && "h-8 px-3 text-[13px]",
      size === "icon" && "h-9 w-9",
      variants[variant],
      className,
    )}
    {...props}
  />
));

// ---------- Card ----------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tnum">{value}</p>
      {hint && <div className="mt-1 text-[13px] text-subtle">{hint}</div>}
    </Card>
  );
}

// ---------- Seitenkopf ----------
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// ---------- Formularfelder ----------
const fieldBase =
  "h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm text-fg placeholder:text-subtle transition-colors focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, className)} {...props} />
));

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, "appearance-none pr-9 cursor-pointer", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  ),
);

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

// ---------- Dialog ----------
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade_150ms_ease-out]" />
        <RDialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
          {...(!description && { "aria-describedby": undefined })}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="text-lg font-semibold tracking-tight">{title}</RDialog.Title>
              {description && <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description>}
            </div>
            <RDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Schließen" className="-mr-2 -mt-1">
                <X className="h-4 w-4" />
              </Button>
            </RDialog.Close>
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Button, der vor der Aktion eine Bestätigung abfragt. */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "Löschen",
  onConfirm,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "icon";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...props} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      />
    </>
  );
}

// ---------- Auswahl Monat / Jahr ----------
export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <div className="flex h-10 items-center rounded-xl border border-line bg-surface">
      <Button variant="ghost" size="icon" aria-label="Vorheriger Monat" onClick={() => onChange(addMonths(value, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[132px] text-center text-sm font-medium tnum">{monthLabel(value)}</span>
      <Button variant="ghost" size="icon" aria-label="Nächster Monat" onClick={() => onChange(addMonths(value, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function YearPicker({ value, onChange, years }: { value: number; onChange: (y: number) => void; years: number[] }) {
  const list = [...new Set([...years, value])].sort((a, b) => b - a);
  return (
    <div className="flex h-10 items-center rounded-xl border border-line bg-surface">
      <Button variant="ghost" size="icon" aria-label="Vorheriges Jahr" onClick={() => onChange(value - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-full cursor-pointer appearance-none bg-transparent px-2 text-center text-sm font-medium tnum focus:outline-none"
        aria-label="Jahr"
      >
        {list.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="icon" aria-label="Nächstes Jahr" onClick={() => onChange(value + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------- Kleinteile ----------
export function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "h-6 w-6 text-[11px]",
        size === "md" && "h-8 w-8 text-xs",
        size === "lg" && "h-10 w-10 text-sm",
      )}
      style={{ backgroundColor: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted", className)}>
      {children}
    </span>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-raised text-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Delta({ value, invert = true }: { value: number | null; invert?: boolean }) {
  if (value === null || !isFinite(value)) return <span className="text-subtle">–</span>;
  // Bei Kosten ist ein Anstieg schlecht (rot), ein Rückgang gut (grün)
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={cn("tnum font-medium", Math.abs(value) < 0.05 ? "text-muted" : good ? "text-accent" : "text-danger")}>
      {value > 0 ? "+" : ""}
      {value.toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %
    </span>
  );
}

export const PRESET_COLORS = [
  "#38bdf8", "#a78bfa", "#f59e0b", "#f472b6", "#34d399", "#fb923c",
  "#facc15", "#2dd4bf", "#60a5fa", "#f87171", "#94a3b8", "#c084fc",
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Farbe ${c}`}
          onClick={() => onChange(c)}
          className={cn(
            "h-7 w-7 rounded-full transition-transform hover:scale-110",
            value === c && "ring-2 ring-fg ring-offset-2 ring-offset-surface",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
