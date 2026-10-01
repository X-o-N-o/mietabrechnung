# Mietabrechnung – Home-Assistant-Add-on

Webapp zur Abrechnung von Miete und Nebenkosten für ein Haus mit Mietern und Besitzern.
Die Nebenkosten des ganzen Hauses werden nach Anteilen aufgeteilt, die Gesamtmiete zu
gleichen Teilen auf die Mieter.

## Installation in Home Assistant

1. **Einstellungen → Add-ons → Add-on-Store → ⋮ → Repositories**
2. `https://github.com/X-o-N-o/mietabrechnung` hinzufügen
3. „Mietabrechnung" installieren und starten, „In Seitenleiste anzeigen" aktivieren

Die App läuft über Ingress, die Daten liegen in `/data` und sind in Backups enthalten.

## Entwicklung

```bash
cd mietabrechnung
npm install
npm run dev:server   # API auf :8099 (Daten in ./.data)
npm run dev          # Frontend auf :5173 mit Proxy auf die API
npm test             # Tests der Rechenlogik
```

Lokal als Container: `docker compose up --build` im Repo-Stamm → http://localhost:8099

## Aufbau

- `mietabrechnung/shared/calc.ts` – Rechenlogik (Aufteilung, Rundung, Berichte)
- `mietabrechnung/server/` – Express-API mit SQLite (`node:sqlite`)
- `mietabrechnung/src/` – React-Frontend (Vite, Tailwind, Recharts, jsPDF)
