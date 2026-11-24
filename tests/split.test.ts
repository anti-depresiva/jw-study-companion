import { describe, expect, it } from "vitest";
import { parseWorkbookText } from "@/lib/import/parse";
import { parseRange, splitWatchtowerArticles, splitWorkbookWeeks } from "@/lib/import/split";

// Eigener Beispieltext im Aufbau eines zweimonatigen Arbeitshefts (kein Originalinhalt).
const week = (range: string, book: string) => `${range}
${book}
SCHÄTZE AUS GOTTES WORT
1. Beispielthema der Woche ${range} (10 Min.)
Ein Gedanke zum Bibelleseprogramm.
2. Nach geistigen Schätzen graben (10 Min.)
Was lernen wir daraus?
3. Bibellesung (4 Min.)
UNS IM DIENST VERBESSERN
4. Ein Gespräch beginnen (3 Min.)
Beispieltext.
UNSER LEBEN ALS CHRIST
7. Versammlungsbibelstudium (30 Min.)
Kapitel, Absätze 1-5.`;

const ISSUE = [
  "Unser Leben und Dienst als Christ – Arbeitsheft",
  week("16.–22. NOVEMBER", "JESAJA 54-55"),
  week("23.–29. NOVEMBER", "JESAJA 56-57"),
  week("30. NOVEMBER – 6. DEZEMBER", "JESAJA 58-59"),
  week("28. DEZEMBER – 3. JÄNNER", "JESAJA 60-61"),
].join("\n");

describe("Datumsbereiche", () => {
  it("erkennt Wochen innerhalb und über Monats-/Jahresgrenzen", () => {
    expect(parseRange("23.–29. NOVEMBER", 2026)).toMatchObject({ year: 2026, week: 48 });
    expect(parseRange("30. NOVEMBER – 6. DEZEMBER", 2026)).toMatchObject({ year: 2026, week: 49 });
    expect(parseRange("28. DEZEMBER – 3. JÄNNER", 2027)).toMatchObject({ year: 2026, week: 53 });
    expect(parseRange("29. Dezember 2025 – 4. Januar 2026", 2026)).toMatchObject({ year: 2026, week: 1 });
  });
});

describe("Arbeitsheft-Ausgabe mit mehreren Wochen", () => {
  it("liefert nur die gewünschte Woche", () => {
    const split = splitWorkbookWeeks(ISSUE, 2026, 48);
    expect(split.weeks).toHaveLength(4);
    expect(split.text).toContain("JESAJA 56-57");
    expect(split.text).not.toContain("JESAJA 58-59");
    const wb = parseWorkbookText(split.text!);
    expect(wb.items).toHaveLength(5);
    expect(wb.bibleReading).toBe("JESAJA 56-57");
  });
  it("findet die Woche über den Jahreswechsel", () => {
    expect(splitWorkbookWeeks(ISSUE, 2026, 53).text).toContain("JESAJA 60-61");
  });
  it("meldet, wenn die Woche fehlt", () => {
    const split = splitWorkbookWeeks(ISSUE, 2026, 40);
    expect(split.text).toBeNull();
    expect(split.weeks.length).toBe(4);
  });
});

const article = (n: number, title: string) => `STUDIENARTIKEL ${n}
LIED 10 Beispiellied
${title}
1 ${"Ein Beispielabsatz mit ausreichend Text für den Test. ".repeat(6)}
1. Worum geht es im Beispiel?`;

const WT = [
  "INHALT",
  "STUDIENARTIKEL 47",
  "16.–22. November 2026",
  "STUDIENARTIKEL 48",
  "23.–29. November 2026",
  article(47, "Erster Testartikel über Geduld"),
  article(48, "Zweiter Testartikel über Freude"),
].join("\n");

describe("Wachtturm-Ausgabe mit mehreren Studienartikeln", () => {
  it("ordnet Studienartikel ihrer Woche zu", () => {
    const cands = splitWatchtowerArticles(WT, 2026, 48);
    expect(cands.map((c) => c.number)).toEqual(["47", "48"]);
    expect(cands.find((c) => c.number === "48")?.week).toMatchObject({ year: 2026, week: 48 });
    expect(cands.find((c) => c.number === "48")?.text).toContain("Freude");
    expect(cands.find((c) => c.number === "48")?.text).not.toContain("Geduld");
  });
});
