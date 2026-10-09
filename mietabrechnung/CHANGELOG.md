# Changelog

## 1.2.1

- Ostrom wird nur noch angefragt, wenn etwas fällig ist: neue abgeschlossene Monate sowie
  Nachkorrekturen bis 7 Tage nach Monatsende (höchstens einmal pro Tag). Vertragsdaten werden
  zwischengespeichert, der Knopf „Abrufen“ ist auf einmal pro 15 Minuten begrenzt.
- Jede Anfrage an Ostrom erscheint im Add-on-Log.

## 1.2.0

- Ostrom-Anbindung: Ein Nebenkostenposten kann „Automatisch aus Ostrom“ kommen. Die App
  berechnet die Stromkosten jedes abgeschlossenen Monats aus Smart-Meter-Verbrauch ×
  stündlichem Preis inkl. Steuern/Umlagen plus Grundgebühr und Netzentgelt.
- Abgleich beim Start und alle 6 Stunden; Übersicht und manueller Abruf in den Einstellungen.

## 1.1.0

- Nebenkosten sind jetzt wiederkehrende Posten mit Turnus (monatlich, vierteljährlich,
  halbjährlich, jährlich oder einmalig). Sie laufen automatisch weiter, bis ab einem
  Monat ein neuer Betrag eingetragen oder der Posten beendet wird.
- Quartals-, Halbjahres- und Jahresbeträge werden gleichmäßig auf die Monate verteilt.
- Bestehende Einzelposten werden beim Update automatisch als einmalige Posten übernommen.
- „Vormonat übernehmen" entfällt.

## 1.0.0

- Erste Version: Personen mit Rollen und Anteilen, Gesamtmiete mit Gültig-ab-Datum,
  Nebenkosten je Monat und Kategorie
- Übersicht pro Monat, Statistik mit Vorjahresvergleich, Endabrechnung mit PDF- und CSV-Export
- Dark Mode als Standard, Home-Assistant-Ingress
