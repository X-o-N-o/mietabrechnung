import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR || "/data";
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "mietabrechnung.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'tenant')),
    shares INTEGER NOT NULL DEFAULT 1,
    color TEXT NOT NULL DEFAULT '#38bdf8',
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#94a3b8'
  );
  CREATE TABLE IF NOT EXISTS rents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount INTEGER NOT NULL,
    valid_from TEXT NOT NULL UNIQUE,
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    description TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    interval INTEGER NOT NULL CHECK (interval IN (0, 1, 3, 6, 12)),
    start_month TEXT NOT NULL,
    end_month TEXT
  );
  CREATE TABLE IF NOT EXISTS item_amounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    valid_from TEXT NOT NULL,
    amount INTEGER NOT NULL,
    UNIQUE (item_id, valid_from)
  );
`);

// Migration 1.0.0 → 1.1.0: einzelne Monatsposten werden zu einmaligen Posten
const hasOldCosts = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'costs'").get();
if (hasOldCosts) {
  db.exec("BEGIN");
  try {
    const old = db.prepare("SELECT category_id, description, amount, month, note FROM costs ORDER BY month, id").all() as {
      category_id: number;
      description: string;
      amount: number;
      month: string;
      note: string;
    }[];
    const insItem = db.prepare("INSERT INTO items (category_id, description, note, interval, start_month) VALUES (?, ?, ?, 0, ?)");
    const insAmount = db.prepare("INSERT INTO item_amounts (item_id, valid_from, amount) VALUES (?, ?, ?)");
    for (const c of old) {
      const r = insItem.run(c.category_id, c.description, c.note, c.month);
      insAmount.run(r.lastInsertRowid, c.month, c.amount);
    }
    db.exec("DROP TABLE costs");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Erststart: Personen und Standard-Kategorien anlegen
const personCount = db.prepare("SELECT COUNT(*) AS n FROM persons").get() as { n: number };
if (personCount.n === 0) {
  const ins = db.prepare("INSERT INTO persons (name, role, shares, color, sort) VALUES (?, ?, 1, ?, ?)");
  ins.run("Dan", "owner", "#f59e0b", 0);
  ins.run("Oma", "owner", "#f472b6", 1);
  ins.run("Jay", "tenant", "#38bdf8", 2);
  ins.run("Steve", "tenant", "#a78bfa", 3);
}
const catCount = db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number };
if (catCount.n === 0) {
  const ins = db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)");
  for (const [name, color] of [
    ["Strom", "#facc15"],
    ["Heizung / Gas", "#fb923c"],
    ["Wasser / Abwasser", "#38bdf8"],
    ["Müllabfuhr", "#4ade80"],
    ["Grundsteuer", "#a78bfa"],
    ["Versicherung", "#f472b6"],
    ["Schornsteinfeger", "#94a3b8"],
    ["Hausmeister / Garten", "#2dd4bf"],
    ["Sonstiges", "#64748b"],
  ]) ins.run(name, color);
}
