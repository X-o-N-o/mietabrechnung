import type { Report } from "@shared/types.ts";
import { formatEuro, monthLabel } from "./format";

// PDF-Standardschriften kennen kein schmales Leerzeichen
const eur = (c: number) => formatEuro(c).replace(/[  ]/g, " ");
const today = () => new Date().toLocaleDateString("de-DE");

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- CSV ----------
export function exportCsv(report: Report, year: number) {
  const num = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const persons = report.persons;
  const rows: string[][] = [];

  rows.push([`Endabrechnung ${year}`]);
  rows.push([]);
  rows.push(["Kategorie", "Haus gesamt", ...persons.map((p) => p.name)]);
  for (const c of report.categories) rows.push([c.name, num(c.total), ...persons.map((p) => num(c.perPerson[p.id] ?? 0))]);
  rows.push(["Summe Nebenkosten", num(report.totals.costs), ...persons.map((p) => num(report.totals.perPerson[p.id].costs))]);
  rows.push(["Miete", num(report.totals.rent), ...persons.map((p) => num(report.totals.perPerson[p.id].rent))]);
  rows.push(["Gesamt", num(report.totals.costs + report.totals.rent), ...persons.map((p) => num(report.totals.perPerson[p.id].total))]);
  rows.push([]);
  rows.push(["Monat", "Miete gesamt", "Nebenkosten gesamt", ...persons.map((p) => `${p.name} gesamt`)]);
  for (const m of report.months)
    rows.push([monthLabel(m.month), num(m.rentTotal), num(m.costTotal), ...persons.map((p) => num(m.persons[p.id].total))]);

  const csv = "﻿" + rows.map((r) => r.map((v) => (/^-?\d+,\d{2}$/.test(v) ? v : q(v))).join(";")).join("\r\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `Endabrechnung_${year}.csv`);
}

// ---------- PDF ----------
export async function exportPdf(report: Report, year: number) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const persons = report.persons;
  const tenants = persons.filter((p) => p.role === "tenant");
  const accent: [number, number, number] = [5, 150, 105];
  const W = doc.internal.pageSize.getWidth();

  const head = (title: string, subtitle: string) => {
    doc.setFillColor(...accent);
    doc.rect(0, 0, W, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(17, 20, 27);
    doc.text(title, 15, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 107, 122);
    doc.text(subtitle, 15, 27);
    doc.text(`Erstellt am ${today()}`, W - 15, 27, { align: "right" });
  };

  const tableStyle = {
    theme: "plain" as const,
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: [40, 44, 52] as [number, number, number] },
    headStyles: { fontStyle: "bold" as const, textColor: [100, 107, 122] as [number, number, number], fillColor: [241, 243, 246] as [number, number, number] },
    footStyles: { fontStyle: "bold" as const, textColor: [17, 20, 27] as [number, number, number], fillColor: [241, 243, 246] as [number, number, number] },
    bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: [226, 229, 234] as [number, number, number] },
    margin: { left: 15, right: 15 },
  };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Seite 1: Gesamtübersicht
  head(`Nebenkostenabrechnung ${year}`, `Zeitraum 01.01.${year} – 31.12.${year} · Aufteilung nach Anteilen`);
  const shareText = persons.map((p) => `${p.name} (${p.role === "tenant" ? "Mieter" : "Besitzer"}, ${p.shares} Anteil${p.shares === 1 ? "" : "e"})`).join(", ");
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(`Personen: ${shareText}`, W - 30), 15, 35);

  const numCols = Object.fromEntries([1, ...persons.map((_, i) => i + 2)].map((i) => [i, { halign: "right" as const }]));
  autoTable(doc, {
    ...tableStyle,
    startY: 44,
    head: [["Kategorie", "Haus gesamt", ...persons.map((p) => p.name)]],
    body: report.categories.map((c) => [c.name, eur(c.total), ...persons.map((p) => eur(c.perPerson[p.id] ?? 0))]),
    foot: [
      ["Summe Nebenkosten", eur(report.totals.costs), ...persons.map((p) => eur(report.totals.perPerson[p.id].costs))],
      ["Miete", eur(report.totals.rent), ...persons.map((p) => (p.role === "tenant" ? eur(report.totals.perPerson[p.id].rent) : "–"))],
      ["Gesamt", eur(report.totals.costs + report.totals.rent), ...persons.map((p) => eur(report.totals.perPerson[p.id].total))],
    ],
    columnStyles: numCols,
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index > 0) d.cell.styles.halign = "right";
      if (d.section === "foot" && d.column.index > 0) d.cell.styles.halign = "right";
    },
  });

  doc.setFontSize(8.5);
  doc.setTextColor(100, 107, 122);
  doc.text(
    doc.splitTextToSize(
      "Die Anteile der Besitzer werden ausgewiesen, aber nicht in Rechnung gestellt. Rundungscents werden so verteilt, dass die Summe aller Anteile exakt dem Gesamtbetrag entspricht.",
      W - 30,
    ),
    15,
    lastY() + 8,
  );

  // Je Mieter eine eigene Seite
  for (const t of tenants) {
    doc.addPage();
    const a = report.totals.perPerson[t.id];
    head(`Abrechnung für ${t.name}`, `Jahr ${year} · Miete und Nebenkosten-Anteil`);

    // Zusammenfassung
    const boxes = [
      ["Miete", eur(a.rent)],
      ["Nebenkosten-Anteil", eur(a.costs)],
      ["Gesamt", eur(a.total)],
    ];
    const bw = (W - 30 - 8) / 3;
    boxes.forEach(([label, value], i) => {
      const x = 15 + i * (bw + 4);
      doc.setFillColor(i === 2 ? 236 : 246, i === 2 ? 253 : 247, i === 2 ? 245 : 249);
      doc.roundedRect(x, 34, bw, 20, 2, 2, "F");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 107, 122);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + 4, 41);
      doc.setFontSize(13);
      doc.setTextColor(17, 20, 27);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + 4, 49);
    });

    autoTable(doc, {
      ...tableStyle,
      startY: 62,
      head: [["Monat", "Miete", "Nebenkosten Haus", "Anteil Nebenkosten", "Zu zahlen"]],
      body: report.months.map((m) => [
        monthLabel(m.month),
        eur(m.persons[t.id].rent),
        eur(m.costTotal),
        eur(m.persons[t.id].costs),
        eur(m.persons[t.id].total),
      ]),
      foot: [["Summe", eur(a.rent), eur(report.totals.costs), eur(a.costs), eur(a.total)]],
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" } },
      didParseCell: (d) => {
        if ((d.section === "head" || d.section === "foot") && d.column.index > 0) d.cell.styles.halign = "right";
      },
    });

    autoTable(doc, {
      ...tableStyle,
      startY: lastY() + 8,
      head: [["Nebenkosten nach Kategorie", "Haus gesamt", `Anteil ${t.name}`]],
      body: report.categories.map((c) => [c.name, eur(c.total), eur(c.perPerson[t.id] ?? 0)]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index > 0) d.cell.styles.halign = "right";
      },
    });
  }

  // Seitenzahlen
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 146, 158);
    doc.setFont("helvetica", "normal");
    doc.text(`Seite ${i} von ${pages}`, W - 15, doc.internal.pageSize.getHeight() - 10, { align: "right" });
  }

  download(doc.output("blob"), `Endabrechnung_${year}.pdf`);
}
