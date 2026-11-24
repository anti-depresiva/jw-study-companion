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

// Nachbildung des echten jw.org-PDF-Layouts (eigener Text): Sperrsatz-Kopfzeile mit
// angeklebter Seitenzahl, Kopfzeile teils am Seitenende, zerlegte Umlaute, Steuerzeichen.
const D = String.fromCharCode(0xa8);
const C = String.fromCharCode(2);
const pdfWeek = (header: string, headerAtEnd: boolean) => {
  const body = `${C}${C} SCH ${D}\nATZE\nAUS GOTTES WORT\n1. Ein Beispielthema, das\nüber zwei Zeilen läuft\n(10 Min.)\nSprich ${D}\nuber den Text. Was k ${D}\nonnte helfen?\n2. Nach geistigen Sch ${D}\natzen graben (10 Min.)\n3. Bibellesung (4 Min.)\nUNS IM DIENST\nVERBESSERN\n4. Gespr ${D}\nache beginnen (3 Min.)\n5. Was w ${D}\nurdest du sagen? (5 Min.) Besprechung.`;
  const second = `7\nUNSER LEBEN\nALS CHRIST\n6. Ein Punkt (15 Min.)\nText.\n7. Versammlungsbibelstudium (30 Min.)\nKapitel 1.`;
  return [headerAtEnd ? `${body}\n${header}` : `${header}\n${body}`, second];
};
const PDF_PAGES = [
  "TITELSEITE",
  ...pdfWeek("2 . - 8 . N OVEMB ER JE R E M IA 4 9 - 5 0", true),
  ...pdfWeek("62 3 . - 2 9. N OVEMB ER KLAG E LI E D E R 3 - 5", false),
  ...pdfWeek("128 . D EZEMB ER– 3 . JAN UAR H E S E KI E L 9 - 10", false),
  "169. -1 5 . N OVEMB ER\nRückseite mit Hinweis",
];

describe("Arbeitsheft-PDF im jw.org-Layout", () => {
  it("erkennt die Wochen seitenweise trotz Sperrsatz und Seitenzahl", async () => {
    const { splitWorkbookPages } = await import("@/lib/import/split");
    const all = splitWorkbookPages(PDF_PAGES, 2026, 48);
    expect(all.weeks.map((w) => `${w.year}-${w.week}`)).toEqual(["2026-45", "2026-48", "2026-53"]);
    expect(all.bibleReading).toBe("Klagelieder 3-5");
    const wb = parseWorkbookText(all.text!);
    expect(wb.items.map((i) => [i.section, i.title, i.duration])).toEqual([
      ["schaetze", "Ein Beispielthema, das über zwei Zeilen läuft", "10 Min."],
      ["schaetze", "Nach geistigen Schätzen graben", "10 Min."],
      ["schaetze", "Bibellesung", "4 Min."],
      ["dienst", "Gespräche beginnen", "3 Min."],
      ["dienst", "Was würdest du sagen?", "5 Min."],
      ["leben", "Ein Punkt", "15 Min."],
      ["versammlungsbibelstudium", "Versammlungsbibelstudium", "30 Min."],
    ]);
    expect(wb.items[0].originalText).toContain("Sprich über den Text");
    expect(wb.items[0].questions).toEqual(["Was könnte helfen?"]);
    expect(wb.items[4].originalText).toBe("Besprechung.");
  });
  it("findet die Kopfzeile auch am Seitenende und über den Jahreswechsel", async () => {
    const { splitWorkbookPages } = await import("@/lib/import/split");
    expect(splitWorkbookPages(PDF_PAGES, 2026, 45).bibleReading).toBe("Jeremia 49-50");
    expect(splitWorkbookPages(PDF_PAGES, 2026, 53).bibleReading).toBe("Hesekiel 9-10");
  });
});
