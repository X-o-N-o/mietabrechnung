import fs from "node:fs";
import path from "node:path";
import { dataDir, db } from "./db.ts";
import { monthFromIndex, monthIndex } from "../shared/calc.ts";
import { berlinMonthStart, monthCost, type ConsumptionHour, type PriceHour } from "../shared/ostrom.ts";

const AUTH_URL = "https://auth.production.ostrom-api.io/oauth2/token";
const API_URL = "https://production.ostrom-api.io";
// Abgeschlossene Monate werden noch so lange neu abgerufen, falls Ostrom Messwerte nachliefert
const REFRESH_MONTHS = 2;

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

let running: Promise<void> | null = null;

/** Holt fehlende bzw. kürzlich abgeschlossene Monate und trägt sie bei allen Ostrom-Posten als Betrag ein. */
export function syncOstrom(): Promise<void> {
  running ??= doSync().finally(() => (running = null));
  return running;
}

async function doSync() {
  const cfg = ostromConfig();
  const items = db.prepare("SELECT id, start_month AS startMonth FROM items WHERE source = 'ostrom'").all() as {
    id: number;
    startMonth: string;
  }[];
  if (!cfg || items.length === 0) return;

  try {
    const { data } = await api<{ data: Contract[] }>(cfg, "/contracts");
    const contract =
      data.find((c) => String(c.id) === cfg.contractId) ?? data.find((c) => c.type === "ELECTRICITY" && c.status === "ACTIVE");
    if (!contract) throw new Error("Kein aktiver Ostrom-Stromvertrag gefunden");

    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const last = monthIndex(current) - 1; // letzter abgeschlossener Monat
    const first = Math.max(monthIndex(contract.startDate.slice(0, 7)), Math.min(...items.map((i) => monthIndex(i.startMonth))));
    const known = new Set((db.prepare("SELECT month FROM ostrom_months").all() as { month: string }[]).map((r) => r.month));

    const save = db.prepare(
      `INSERT INTO ostrom_months (month, kwh, amount, energy_amount, fees_amount, synced_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (month) DO UPDATE SET kwh = excluded.kwh, amount = excluded.amount, energy_amount = excluded.energy_amount,
       fees_amount = excluded.fees_amount, synced_at = excluded.synced_at`,
    );
    for (let i = first; i <= last; i++) {
      const month = monthFromIndex(i);
      if (known.has(month) && i < last - REFRESH_MONTHS + 1) continue;
      const q = `startDate=${berlinMonthStart(month)}&endDate=${berlinMonthStart(monthFromIndex(i + 1))}&resolution=HOUR`;
      const [hours, prices] = await Promise.all([
        api<{ data: ConsumptionHour[] }>(cfg, `/contracts/${contract.id}/energy-consumption?${q}`),
        api<{ data: PriceHour[] }>(cfg, `/spot-prices?${q}&zip=${encodeURIComponent(contract.address.zip)}`),
      ]);
      if (hours.data.length === 0) continue; // noch keine Messwerte
      const c = monthCost(hours.data, prices.data);
      save.run(month, c.kwh, c.amount, c.energyAmount, c.feesAmount, new Date().toISOString());
    }

    // Monatswerte als Beträge bei den verknüpften Posten eintragen
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
    setSetting("ostrom_last_sync", new Date().toISOString());
    setSetting("ostrom_last_error", null);
  } catch (e) {
    setSetting("ostrom_last_error", (e as Error).message);
    console.error("Ostrom-Abgleich:", (e as Error).message);
  }
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

/** Abgleich beim Start und danach alle 6 Stunden. */
export function startOstromSchedule() {
  if (!ostromConfig()) return;
  setTimeout(() => void syncOstrom(), 5_000);
  setInterval(() => void syncOstrom(), 6 * 60 * 60 * 1000);
}
