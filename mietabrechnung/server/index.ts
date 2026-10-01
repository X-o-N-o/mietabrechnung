import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "./db.ts";
import { buildReport, expandItems, monthIndex } from "../shared/calc.ts";
import type { Category, Item, ItemAmount, Person, Rent } from "../shared/types.ts";

const app = express();
app.use(express.json());

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function str(v: unknown, field: string, { required = true, max = 200 } = {}): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new HttpError(400, `${field} fehlt`);
  if (s.length > max) throw new HttpError(400, `${field} ist zu lang`);
  return s;
}
function int(v: unknown, field: string, { min = -Infinity } = {}): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min) throw new HttpError(400, `${field} ist ungültig`);
  return v;
}
function month(v: unknown, field: string): string {
  if (typeof v !== "string" || !MONTH.test(v)) throw new HttpError(400, `${field} muss im Format JJJJ-MM sein`);
  return v;
}
function id(req: Request): number {
  const n = Number(req.params.id);
  if (!Number.isInteger(n)) throw new HttpError(400, "Ungültige ID");
  return n;
}
function changed(result: { changes: number | bigint }) {
  if (Number(result.changes) === 0) throw new HttpError(404, "Nicht gefunden");
}

const route =
  (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = fn(req, res);
      if (out !== undefined) res.json(out);
      else res.status(204).end();
    } catch (e) {
      next(e);
    }
  };

// ---------- Lesefunktionen ----------
const getPersons = () =>
  db.prepare("SELECT id, name, role, shares, color, sort FROM persons ORDER BY sort, id").all() as unknown as Person[];
const getCategories = () =>
  db.prepare("SELECT id, name, color FROM categories ORDER BY name COLLATE NOCASE").all() as unknown as Category[];
const getRents = () =>
  db.prepare("SELECT id, amount, valid_from AS validFrom, note FROM rents ORDER BY valid_from").all() as unknown as Rent[];

// ---------- Personen ----------
function personInput(b: any) {
  const role = b.role === "owner" || b.role === "tenant" ? b.role : null;
  if (!role) throw new HttpError(400, "Rolle ist ungültig");
  return {
    name: str(b.name, "Name", { max: 60 }),
    role,
    shares: int(b.shares, "Anteile", { min: 0 }),
    color: str(b.color, "Farbe", { max: 20 }),
  };
}
app.get("/api/persons", route(() => getPersons()));
app.post(
  "/api/persons",
  route((req) => {
    const p = personInput(req.body);
    const sort = (db.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM persons").get() as { s: number }).s;
    const r = db
      .prepare("INSERT INTO persons (name, role, shares, color, sort) VALUES (?, ?, ?, ?, ?)")
      .run(p.name, p.role, p.shares, p.color, sort);
    return { id: Number(r.lastInsertRowid) };
  }),
);
app.put(
  "/api/persons/:id",
  route((req) => {
    const p = personInput(req.body);
    changed(
      db.prepare("UPDATE persons SET name = ?, role = ?, shares = ?, color = ? WHERE id = ?").run(p.name, p.role, p.shares, p.color, id(req)),
    );
  }),
);
app.delete("/api/persons/:id", route((req) => void changed(db.prepare("DELETE FROM persons WHERE id = ?").run(id(req)))));

// ---------- Kategorien ----------
app.get("/api/categories", route(() => getCategories()));
app.post(
  "/api/categories",
  route((req) => {
    const r = db
      .prepare("INSERT INTO categories (name, color) VALUES (?, ?)")
      .run(str(req.body.name, "Name", { max: 60 }), str(req.body.color, "Farbe", { max: 20 }));
    return { id: Number(r.lastInsertRowid) };
  }),
);
app.put(
  "/api/categories/:id",
  route((req) => {
    changed(
      db
        .prepare("UPDATE categories SET name = ?, color = ? WHERE id = ?")
        .run(str(req.body.name, "Name", { max: 60 }), str(req.body.color, "Farbe", { max: 20 }), id(req)),
    );
  }),
);
app.delete(
  "/api/categories/:id",
  route((req) => {
    const used = db.prepare("SELECT COUNT(*) AS n FROM items WHERE category_id = ?").get(id(req)) as { n: number };
    if (used.n > 0) throw new HttpError(409, `Kategorie wird von ${used.n} Posten verwendet`);
    changed(db.prepare("DELETE FROM categories WHERE id = ?").run(id(req)));
  }),
);

// ---------- Miete ----------
function rentInput(b: any) {
  return {
    amount: int(b.amount, "Betrag", { min: 0 }),
    validFrom: month(b.validFrom, "Gültig ab"),
    note: str(b.note, "Notiz", { required: false, max: 500 }),
  };
}
app.get("/api/rents", route(() => getRents()));
app.post(
  "/api/rents",
  route((req) => {
    const r = rentInput(req.body);
    const res = db.prepare("INSERT INTO rents (amount, valid_from, note) VALUES (?, ?, ?)").run(r.amount, r.validFrom, r.note);
    return { id: Number(res.lastInsertRowid) };
  }),
);
app.put(
  "/api/rents/:id",
  route((req) => {
    const r = rentInput(req.body);
    changed(db.prepare("UPDATE rents SET amount = ?, valid_from = ?, note = ? WHERE id = ?").run(r.amount, r.validFrom, r.note, id(req)));
  }),
);
app.delete("/api/rents/:id", route((req) => void changed(db.prepare("DELETE FROM rents WHERE id = ?").run(id(req)))));

// ---------- Nebenkosten-Posten ----------
const INTERVALS = [0, 1, 3, 6, 12];

function getItems(): Item[] {
  const items = db
    .prepare(
      "SELECT id, category_id AS categoryId, description, note, interval, start_month AS startMonth, end_month AS endMonth FROM items ORDER BY start_month, id",
    )
    .all() as unknown as Item[];
  const amounts = db
    .prepare("SELECT id, item_id AS itemId, valid_from AS validFrom, amount FROM item_amounts ORDER BY valid_from")
    .all() as unknown as (ItemAmount & { itemId: number })[];
  const byItem = new Map<number, ItemAmount[]>(items.map((i) => [i.id, (i.amounts = [])]));
  for (const { itemId, ...a } of amounts) byItem.get(itemId)?.push(a);
  return items;
}

function itemInput(b: any) {
  if (!INTERVALS.includes(b.interval)) throw new HttpError(400, "Turnus ist ungültig");
  const startMonth = month(b.startMonth, "Erste Fälligkeit");
  const endMonth = b.endMonth ? month(b.endMonth, "Ende") : null;
  if (endMonth && endMonth < startMonth) throw new HttpError(400, "Das Ende liegt vor der ersten Fälligkeit");
  return {
    categoryId: int(b.categoryId, "Kategorie"),
    description: str(b.description, "Beschreibung", { required: false }),
    note: str(b.note, "Notiz", { required: false, max: 1000 }),
    interval: b.interval as number,
    startMonth,
    endMonth: b.interval === 0 ? null : endMonth,
  };
}

function inTransaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

app.get("/api/items", route(() => getItems()));
app.post(
  "/api/items",
  route((req) => {
    const i = itemInput(req.body);
    const amount = int(req.body.amount, "Betrag");
    return inTransaction(() => {
      const r = db
        .prepare("INSERT INTO items (category_id, description, note, interval, start_month, end_month) VALUES (?, ?, ?, ?, ?, ?)")
        .run(i.categoryId, i.description, i.note, i.interval, i.startMonth, i.endMonth);
      db.prepare("INSERT INTO item_amounts (item_id, valid_from, amount) VALUES (?, ?, ?)").run(r.lastInsertRowid, i.startMonth, amount);
      return { id: Number(r.lastInsertRowid) };
    });
  }),
);
app.put(
  "/api/items/:id",
  route((req) => {
    const i = itemInput(req.body);
    const itemId = id(req);
    inTransaction(() => {
      changed(
        db
          .prepare("UPDATE items SET category_id = ?, description = ?, note = ?, interval = ?, start_month = ?, end_month = ? WHERE id = ?")
          .run(i.categoryId, i.description, i.note, i.interval, i.startMonth, i.endMonth, itemId),
      );
      // Der früheste Betrag beginnt immer mit der ersten Fälligkeit
      db.prepare(
        "UPDATE item_amounts SET valid_from = ? WHERE id = (SELECT id FROM item_amounts WHERE item_id = ? ORDER BY valid_from LIMIT 1) AND valid_from > ?",
      ).run(i.startMonth, itemId, i.startMonth);
    });
  }),
);
app.delete("/api/items/:id", route((req) => void changed(db.prepare("DELETE FROM items WHERE id = ?").run(id(req)))));

// Beträge: gelten ab validFrom bis zur nächsten Änderung
app.post(
  "/api/items/:id/amounts",
  route((req) => {
    const itemId = id(req);
    if (!db.prepare("SELECT id FROM items WHERE id = ?").get(itemId)) throw new HttpError(404, "Posten nicht gefunden");
    const validFrom = month(req.body.validFrom, "Gültig ab");
    const amount = int(req.body.amount, "Betrag");
    db.prepare(
      "INSERT INTO item_amounts (item_id, valid_from, amount) VALUES (?, ?, ?) ON CONFLICT (item_id, valid_from) DO UPDATE SET amount = excluded.amount",
    ).run(itemId, validFrom, amount);
  }),
);
app.put(
  "/api/items/:id/amounts/:aid",
  route((req) => {
    const validFrom = month(req.body.validFrom, "Gültig ab");
    const amount = int(req.body.amount, "Betrag");
    changed(
      db
        .prepare("UPDATE item_amounts SET valid_from = ?, amount = ? WHERE id = ? AND item_id = ?")
        .run(validFrom, amount, Number(req.params.aid), id(req)),
    );
  }),
);
app.delete(
  "/api/items/:id/amounts/:aid",
  route((req) => {
    const n = db.prepare("SELECT COUNT(*) AS n FROM item_amounts WHERE item_id = ?").get(id(req)) as { n: number };
    if (n.n <= 1) throw new HttpError(409, "Der letzte Betrag kann nicht gelöscht werden");
    changed(db.prepare("DELETE FROM item_amounts WHERE id = ? AND item_id = ?").run(Number(req.params.aid), id(req)));
  }),
);

// ---------- Auswertung ----------
app.get(
  "/api/report",
  route((req) => {
    const from = month(req.query.from, "from");
    const to = month(req.query.to, "to");
    if (monthIndex(to) < monthIndex(from) || monthIndex(to) - monthIndex(from) > 600) throw new HttpError(400, "Zeitraum ist ungültig");
    return buildReport(from, to, getPersons(), getCategories(), getRents(), expandItems(getItems(), from, to));
  }),
);

// Jahre mit Daten (für Jahresauswahl)
app.get(
  "/api/years",
  route(() => {
    const rows = db
      .prepare("SELECT DISTINCT substr(start_month, 1, 4) AS y FROM items UNION SELECT DISTINCT substr(valid_from, 1, 4) FROM rents")
      .all() as { y: string }[];
    const years = new Set(rows.map((r) => Number(r.y)));
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }),
);

app.use("/api", (_req, _res, next) => next(new HttpError(404, "Unbekannter Endpunkt")));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : String(err?.message).includes("UNIQUE") ? 409 : 500;
  const message =
    err instanceof HttpError ? err.message : status === 409 ? "Eintrag existiert bereits" : "Interner Fehler";
  if (status === 500) console.error(err);
  res.status(status).json({ message });
});

// ---------- Frontend ----------
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

const port = Number(process.env.PORT || 8099);
app.listen(port, () => console.log(`Mietabrechnung läuft auf Port ${port}`));
