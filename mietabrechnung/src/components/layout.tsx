import { BarChart3, FileText, Home, KeyRound, LayoutDashboard, Moon, Receipt, Settings, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/cn";

const NAV = [
  { path: "/", label: "Übersicht", short: "Übersicht", icon: LayoutDashboard },
  { path: "/nebenkosten", label: "Nebenkosten", short: "Kosten", icon: Receipt },
  { path: "/miete", label: "Miete", short: "Miete", icon: KeyRound },
  { path: "/statistik", label: "Statistik", short: "Statistik", icon: BarChart3 },
  { path: "/endabrechnung", label: "Endabrechnung", short: "Abrechnung", icon: FileText },
];

// Gemeinsamer Theme-Zustand für alle Komponenten (Quelle: Klasse auf <html>)
const themeListeners = new Set<() => void>();
function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#090b10" : "#f6f7f9");
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
  themeListeners.forEach((l) => l());
}
export function useTheme() {
  const dark = useSyncExternalStore(
    (l) => (themeListeners.add(l), () => themeListeners.delete(l)),
    () => document.documentElement.classList.contains("dark"),
  );
  return [dark, setTheme] as const;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-[0_8px_24px_-8px_rgb(var(--accent)/0.6)]">
        <Home className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">Mietabrechnung</p>
        <p className="text-xs text-subtle">Miete & Nebenkosten</p>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useTheme();
  const isActive = (p: string) => (p === "/" ? location === "/" : location.startsWith(p));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <div className="min-h-dvh">
      {/* Desktop-Seitenleiste */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 px-4 py-6 backdrop-blur md:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {[...NAV, { path: "/einstellungen", label: "Einstellungen", short: "", icon: Settings }].map(({ path, label, icon: Icon }, i) => (
            <Link
              key={path}
              href={path}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                i === NAV.length && "mt-auto",
                isActive(path) ? "bg-raised text-fg" : "text-muted hover:bg-raised/60 hover:text-fg",
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", isActive(path) ? "text-accent" : "text-subtle group-hover:text-muted")} />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => setDark(!dark)}
          className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-raised/60 hover:text-fg"
        >
          {dark ? <Sun className="h-[18px] w-[18px] text-subtle" /> : <Moon className="h-[18px] w-[18px] text-subtle" />}
          {dark ? "Heller Modus" : "Dunkler Modus"}
        </button>
      </aside>

      {/* Mobile Kopfzeile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-lg md:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <button onClick={() => setDark(!dark)} className="rounded-xl p-2.5 text-muted hover:bg-raised" aria-label="Design wechseln">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link
            href="/einstellungen"
            className={cn("rounded-xl p-2.5 hover:bg-raised", isActive("/einstellungen") ? "text-accent" : "text-muted")}
            aria-label="Einstellungen"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 md:ml-64 md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile Tab-Leiste */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/90 px-1 pt-1.5 backdrop-blur-lg md:hidden">
        {NAV.map(({ path, short, icon: Icon }) => (
          <Link
            key={path}
            href={path}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium transition-colors",
              isActive(path) ? "text-accent" : "text-subtle",
            )}
          >
            <Icon className="h-5 w-5" />
            {short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
