import fs from "node:fs";
import path from "node:path";
import { dataDir, db } from "./db.ts";
import { monthFromIndex, monthIndex } from "../shared/calc.ts";
import { berlinMonthStart, monthCost, type ConsumptionHour, type PriceHour } from "../shared/ostrom.ts";

const AUTH_URL = "https://auth.production.ostrom-api.io/oauth2/token";
const API_URL = "https://production.ostrom-api.io";

interface Config {
  clientId: string;
  clientSecret: string;
  contractId: string;
}

/** Zugangsdaten aus der Add-on-Konfiguration (/data/options.json) oder lokal aus Umgebungsvariablen. */
export function ostromConfig(): Config | null {
  let o: Record<string, string> = {};
  try {
    o = JSON.parse(fs.readFileSync(path.join(dataDir, "options.json"), "utf8"));
  } catch {}
  const clientId = o.ostrom_client_id || process.env.OSTROM_CLIENT_ID || "";
  const clientSecret = o.ostrom_client_secret || process.env.OSTROM_CLIENT_SECRET || "";
  const contractId = o.ostrom_contract_id || process.env.OSTROM_CONTRACT_ID || "";
  return clientId && clientSecret ? { clientId, clientSecret, contractId } : null;
}

let token: { value: string; expires: number } | null = null;

async function api<T>(cfg: Config, p: string): Promise<T> {
  if (!token || token.expires < Date.now() + 60_000) {
    console.log("Ostrom-Anfrage: Token");
    const r = await fetch(AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!r.ok) throw new Error(`Anmeldung bei Ostrom fehlgeschlagen (HTTP ${r.status})`);
    const t = (await r.json()) as { access_token: string; expires_in: number };
    token = { value: t.access_token, expires: Date.now() + t.expires_in * 1000 };
  }
  console.log(`Ostrom-Anfrage: ${p.split("?")[0].replace(/\d+/g, "…")}`);
  const r = await fetch(API_URL + p, { headers: { Authorization: `Bearer ${token.value}` } });
  if (!r.ok) throw new Error(`Ostrom-API ${p.split("?")[0]}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

interface Contract {
  id: number;
  type: string;
  status: string;
  startDate: string;
  address: { zip: string };
}

const setSetting = (key: string, value: string | null) =>
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, value);
const getSetting = (key: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;

// Ostrom sperrt bei zu vielen Anfragen. Deshalb wird nur angefragt, wenn tatsächlich etwas fällig ist:
// - ein abgeschlossener Monat fehlt noch, oder
// - ein Monat ist höchstens CORRECTION_DAYS alt (Messwerte können nachkommen) und seit 24 h nicht abgerufen.
const CORRECTION_DAYS = 7;
const REFETCH_AFTER_MS = 24 * 60 * 60 * 1000;
const MANUAL_MIN_GAP_MS = 15 * 60 * 1000;

let running: Promise<string | null> | null = null;

/**
 * Gleicht Ostrom ab und trägt die Monatswerte bei allen Ostrom-Posten ein.
 * `force` (Knopf „Abrufen“) holt die jüngsten Monate auch ohne 24-h-Wartezeit, höchstens alle 15 Minuten.
 * Gibt einen Hinweis zurück, falls ein manueller Abruf gedrosselt wurde.
 */
export function syncOstrom(force = false): Promise<string | null> {
  running ??= doSync(force).finally(() => (running = null));
  return running;
}

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

async function getContract(cfg: Config): Promise<Contract> {
  const cached = getSetting("ostrom_contract");
  if (cached) {
    const c = JSON.parse(cached) as Contract;
    if (!cfg.contractId || String(c.id) === cfg.contractId) return c;
  }
  const { data } = await api<{ data: Contract[] }>(cfg, "/contracts");
  const contract =
    data.find((c) => String(c.id) === cfg.contractId) ?? data.find((c) => c.type === "ELECTRICITY" && c.status === "ACTIVE");
  if (!contract) throw new Error("Kein aktiver Ostrom-Stromvertrag gefunden");
  // Nur das Nötige speichern (keine Namen)
  const slim = { id: contract.id, type: contract.type, status: contract.status, startDate: contract.startDate, address: { zip: contract.address.zip } };
  setSetting("ostrom_contract", JSON.stringify(slim));
  return slim;
}

function applyToItems(items: { id: number; startMonth: string }[]) {
  const months = db.prepare("SELECT month, amount FROM ostrom_months").all() as { month: string; amount: number }[];
  const upsert = db.prepare(
    "INSERT INTO item_amounts (item_id, valid_from, amount) VALUES (?, ?, ?) ON CONFLICT (item_id, valid_from) DO UPDATE SET amount = excluded.amount",
  );
  db.exec("BEGIN");
  try {
    for (const item of items) for (const m of months) if (m.month >= item.startMonth) upsert.run(item.id, m.month, m.amount);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

async function doSync(force: boolean): Promise<string | null> {
  const cfg = ostromConfig();
  const items = db.prepare("SELECT id, start_month AS startMonth FROM items WHERE source = 'ostrom'").all() as {
    id: number;
    startMonth: string;
  }[];
  if (!cfg || items.length === 0) return null;

  const now = Date.now();
  let notice: string | null = null;
  try {
    const lastCall = Date.parse(getSetting("ostrom_last_call") ?? "") || 0;
    if (force && now - lastCall < MANUAL_MIN_GAP_MS) {
      force = false;
      notice = `Ostrom wurde gerade erst abgefragt – nächster manueller Abruf in ${Math.ceil((MANUAL_MIN_GAP_MS - (now - lastCall)) / 60000)} Min.`;
    }

    // Fällige Monate rein lokal bestimmen – ohne Anfrage an Ostrom
    const last = monthIndex(currentMonth()) - 1; // letzter abgeschlossener Monat
    const cachedContract = getSetting("ostrom_contract");
    const contractStart = cachedContract ? monthIndex((JSON.parse(cachedContract) as Contract).startDate.slice(0, 7)) : -Infinity;
    const first = Math.max(contractStart, Math.min(...items.map((i) => monthIndex(i.startMonth))));
    const rows = new Map(
      (db.prepare("SELECT month, synced_at AS syncedAt FROM ostrom_months").all() as { month: string; syncedAt: string }[]).map((r) => [
        r.month,
        Date.parse(r.syncedAt),
      ]),
    );
    const due: string[] = [];
    for (let i = first; i <= last; i++) {
      const month = monthFromIndex(i);
      const syncedAt = rows.get(month);
      const monthEnd = Date.parse(berlinMonthStart(monthFromIndex(i + 1)));
      const recent = now - monthEnd < CORRECTION_DAYS * 24 * 60 * 60 * 1000;
      if (syncedAt === undefined || (recent && (force || now - syncedAt > REFETCH_AFTER_MS))) due.push(month);
    }

    if (due.length > 0) {
      setSetting("ostrom_last_call", new Date(now).toISOString());
      const contract = await getContract(cfg);
      const save = db.prepare(
        `INSERT INTO ostrom_months (month, kwh, amount, energy_amount, fees_amount, synced_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (month) DO UPDATE SET kwh = excluded.kwh, amount = excluded.amount, energy_amount = excluded.energy_amount,
         fees_amount = excluded.fees_amount, synced_at = excluded.synced_at`,
      );
      for (const month of due) {
        if (monthIndex(month) < monthIndex(contract.startDate.slice(0, 7))) continue;
        const q = `startDate=${berlinMonthStart(month)}&endDate=${berlinMonthStart(monthFromIndex(monthIndex(month) + 1))}&resolution=HOUR`;
        const hours = await api<{ data: ConsumptionHour[] }>(cfg, `/contracts/${contract.id}/energy-consumption?${q}`);
        if (hours.data.length === 0) {
          // Keine Messwerte: bei älteren Monaten als 0 festhalten, damit sie nie wieder angefragt werden
          const monthEnd = Date.parse(berlinMonthStart(monthFromIndex(monthIndex(month) + 1)));
          if (now - monthEnd >= CORRECTION_DAYS * 24 * 60 * 60 * 1000) save.run(month, 0, 0, 0, 0, new Date().toISOString());
          continue; // Preise gar nicht erst abfragen
        }
        const prices = await api<{ data: PriceHour[] }>(cfg, `/spot-prices?${q}&zip=${encodeURIComponent(contract.address.zip)}`);
        const c = monthCost(hours.data, prices.data);
        save.run(month, c.kwh, c.amount, c.energyAmount, c.feesAmount, new Date().toISOString());
      }
      setSetting("ostrom_last_sync", new Date().toISOString());
    }

    applyToItems(items);
    setSetting("ostrom_last_error", null);
  } catch (e) {
    setSetting("ostrom_last_error", (e as Error).message);
    console.error("Ostrom-Abgleich:", (e as Error).message);
  }
  return notice;
}

export function ostromStatus() {
  return {
    configured: ostromConfig() !== null,
    lastSync: getSetting("ostrom_last_sync"),
    lastError: getSetting("ostrom_last_error"),
    months: db
      .prepare("SELECT month, kwh, amount, energy_amount AS energyAmount, fees_amount AS feesAmount FROM ostrom_months ORDER BY month DESC LIMIT 24")
      .all(),
  };
}

/**
 * Prüft beim Start und danach alle 6 Stunden, ob etwas fällig ist. Angefragt wird nur dann –
 * im Normalbetrieb an den ersten Tagen eines Monats einmal täglich, sonst gar nicht.
 */
export function startOstromSchedule() {
  if (!ostromConfig()) return;
  setTimeout(() => void syncOstrom(), 5_000);
  setInterval(() => void syncOstrom(), 6 * 60 * 60 * 1000);
}
