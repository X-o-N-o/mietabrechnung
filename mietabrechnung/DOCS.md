# Mietabrechnung

Erfasst die Miete und die Nebenkosten des ganzen Hauses und teilt sie auf.

## Rechenlogik

- **Personen** haben eine Rolle (Mieter oder Besitzer) und Anteile (Standard 1).
- **Nebenkosten** werden als Posten mit Turnus angelegt (monatlich, vierteljährlich,
  halbjährlich, jährlich oder einmalig). Ein Posten läuft automatisch weiter; ein neuer
  Betrag gilt ab dem eingetragenen Monat, bis er wieder geändert wird. Mit einem Ende
  hört der Posten auf.
- Quartals-, Halbjahres- und Jahresbeträge werden gleichmäßig auf die Monate ihrer
  Periode verteilt (z. B. Grundsteuer 600 €/Jahr → 50 € pro Monat). Ein geänderter
  Betrag gilt ab der ersten Fälligkeit ab dem gewählten Monat.
- Jede Monatsbelastung wird durch die Summe aller Anteile geteilt. Mieter bekommen ihren
  Anteil in Rechnung gestellt, Besitzer-Anteile werden nur ausgewiesen.
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
