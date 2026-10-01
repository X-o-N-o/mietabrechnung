# Mietabrechnung

Erfasst die Miete und die Nebenkosten des ganzen Hauses und teilt sie auf.

## Rechenlogik

- **Personen** haben eine Rolle (Mieter oder Besitzer) und Anteile (Standard 1).
- **Nebenkosten** werden je Posten durch die Summe aller Anteile geteilt. Mieter
  bekommen ihren Anteil in Rechnung gestellt, Besitzer-Anteile werden nur ausgewiesen.
- **Miete** ist ein Gesamtbetrag für alle Mieter und wird zu gleichen Teilen auf sie
  verteilt. Ein Mieteintrag gilt ab seinem Monat, bis ein neuer eingetragen wird.
- Rundungscents werden so verteilt, dass die Summe aller Anteile exakt dem Gesamtbetrag
  entspricht.

Änderungen an Personen oder Anteilen wirken sich rückwirkend auf alle Monate aus.

## Daten

Die Datenbank liegt unter `/data/mietabrechnung.db` und ist in Home-Assistant-Backups enthalten.

## Zugriff

Die App erscheint über Ingress in der Seitenleiste. Optional kann in der Add-on-Konfiguration
Port 8099 für den Direktzugriff freigegeben werden – dieser ist dann **ohne Anmeldung** erreichbar.
