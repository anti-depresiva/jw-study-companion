import { describe, expect, it } from "vitest";
import { allowedRefs, checkGrounding, filterScriptureList } from "@/lib/ai/grounding";
import { parseWatchtowerText, parseWorkbookText } from "@/lib/import/parse";
import { contentHash, verbatimRatio } from "@/lib/import/text";
import { findScriptures, isCovered } from "@/lib/scripture";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { bibleLookupUrl, wolMeetingsUrl } from "@/lib/sources/links";
import { currentWeek, isoWeekOf, nextMeeting, shiftWeek, todayInVienna, weekRange, weeksInIsoYear } from "@/lib/week";

describe("ISO-Kalenderwochen (Europe/Vienna)", () => {
  it("berechnet bekannte Wochen", () => {
    expect(isoWeekOf("2026-11-24")).toEqual({ year: 2026, week: 48 });
    expect(isoWeekOf("2021-01-03")).toEqual({ year: 2020, week: 53 });
    expect(isoWeekOf("2024-12-30")).toEqual({ year: 2025, week: 1 });
    expect(isoWeekOf("2026-01-01")).toEqual({ year: 2026, week: 1 });
  });
  it("liefert Montag bis Sonntag", () => {
    expect(weekRange(2026, 48)).toMatchObject({ start: "2026-11-23", end: "2026-11-29" });
    expect(weekRange(2020, 53)).toMatchObject({ start: "2020-12-28", end: "2021-01-03" });
  });
  it("kennt 53-Wochen-Jahre und blockiert ungültige Wochen", () => {
    expect(weeksInIsoYear(2026)).toBe(53);
    expect(weeksInIsoYear(2025)).toBe(52);
    expect(() => weekRange(2025, 53)).toThrow();
  });
  it("verwendet die Wiener Zeitzone am Jahreswechsel", () => {
    // 31.12.2026 23:30 UTC ist in Wien bereits der 1.1.2027
    const d = new Date(Date.UTC(2026, 11, 31, 23, 30));
    expect(todayInVienna(d)).toBe("2027-01-01");
    expect(currentWeek(d)).toMatchObject({ year: 2026, week: 53 });
  });
  it("verschiebt Wochen über Jahresgrenzen", () => {
    expect(shiftWeek(2026, 53, 1)).toMatchObject({ year: 2027, week: 1 });
    expect(shiftWeek(2027, 1, -1)).toMatchObject({ year: 2026, week: 53 });
  });
  it("findet die nächste Zusammenkunft", () => {
    const tuesday = new Date("2026-11-24T10:00:00Z");
    expect(nextMeeting(3, 7, tuesday)).toMatchObject({ date: "2026-11-25", kind: "midweek" });
    const thursday = new Date("2026-11-26T10:00:00Z");
    expect(nextMeeting(3, 7, thursday)).toMatchObject({ date: "2026-11-29", kind: "weekend" });
  });
});

describe("Domain-Beschränkung jw.org", () => {
  it("akzeptiert nur HTTPS auf jw.org und zugelassenen Subdomains", () => {
    expect(checkOfficialUrl("https://www.jw.org/de/bibliothek/").ok).toBe(true);
    expect(checkOfficialUrl("https://wol.jw.org/de/wol/meetings/r10/lp-x/2026/48").ok).toBe(true);
    expect(checkOfficialUrl("https://jw.org/").ok).toBe(true);
  });
  it("lehnt fremde und trickreiche Adressen ab", () => {
    for (const bad of [
      "http://www.jw.org/de/",
      "https://jw.org.evil.com/",
      "https://evil.com/?u=https://jw.org",
      "https://fakejw.org/",
      "https://user:pw@www.jw.org/",
      "https://www.jw.org:8443/",
      "https://b.jw.org/",
      "javascript:alert(1)",
      "https://de.wikipedia.org/wiki/Jehovas_Zeugen",
      "",
    ]) {
      expect(checkOfficialUrl(bad).ok, bad).toBe(false);
    }
  });
  it("erzeugt gültige offizielle Links", () => {
    expect(checkOfficialUrl(wolMeetingsUrl(2026, 48)).ok).toBe(true);
    expect(bibleLookupUrl("Johannes 3:16")).toContain("wol.jw.org");
  });
});

describe("Bibelstellen", () => {
  it("erkennt Lang- und Kurzformen", () => {
    const refs = findScriptures("Lies Johannes 3:16, 17 und vergleiche Ps 23:1-4 sowie 1. Korinther 13:4 und 2Ti 3:16.");
    expect(refs.map((r) => r.label)).toEqual([
      "Johannes 3:16, 17",
      "Psalm 23:1-4",
      "1. Korinther 13:4",
      "2. Timotheus 3:16",
    ]);
  });
  it("unterscheidet 1. Johannes und Johannes", () => {
    expect(findScriptures("1. Johannes 4:8")[0].bookName).toBe("1. Johannes");
    expect(findScriptures("Johannes 4:8")[0].bookName).toBe("Johannes");
  });
  it("vermeidet Fehltreffer bei kurzen Abkürzungen", () => {
    expect(findScriptures("Am 5. Mai trafen wir uns. Da 3 Brüder kamen …")).toHaveLength(0);
    expect(findScriptures("Am 5:24")[0].bookName).toBe("Amos");
  });
  it("erkennt Kapitelbereiche und prüft Abdeckung", () => {
    const [reading] = findScriptures("Jesaja 58-59");
    expect(reading).toMatchObject({ chapter: 58, chapterEnd: 59, verses: [] });
    const [ref] = findScriptures("Jesaja 59:1");
    expect(isCovered(ref, [reading])).toBe(true);
    const [other] = findScriptures("Jesaja 60:1");
    expect(isCovered(other, [reading])).toBe(false);
  });
});

describe("Quellenbindung der KI-Antworten", () => {
  const allowed = allowedRefs("Jehova ist uns nahe (Psalm 34:18). Lies auch Jakobus 4:8.");
  it("erkennt erfundene Bibelstellen", () => {
    const res = checkGrounding(["Wie Psalm 34:18 zeigt … und Römer 8:38 sagt …"], allowed);
    expect(res.ok).toBe(false);
    expect(res.invented).toEqual(["Römer 8:38"]);
  });
  it("lässt belegte Stellen durch", () => {
    expect(checkGrounding(["Jakobus 4:8 ermutigt uns."], allowed).ok).toBe(true);
  });
  it("filtert Bibelstellenlisten", () => {
    expect(filterScriptureList(["Psalm 34:18", "Römer 8:38"], allowed)).toEqual(["Psalm 34:18"]);
  });
});

// Eigener Beispieltext im Aufbau eines Studienartikels (kein Originalinhalt).
const SAMPLE_ARTICLE = `STUDIENARTIKEL 48
LIED 100 Ein Beispiellied
Wie wir einander im Alltag ermutigen können
„Ermuntert einander weiterhin“ (Beispiel 1:1).
VORSCHAU: Ein kurzer Überblick über den Beispielartikel.
1 Jeder von uns braucht hin und wieder Ermunterung. In diesem
Beispielabsatz wird gezeigt, wie wichtig ein freundliches Wort ist (Sprüche 12:25).
2 Auch kleine Gesten können viel bewirken. Ein Besuch oder eine kurze
Nachricht zeigt, dass wir an andere denken.
3 Manchmal fällt es schwer, die richtigen Worte zu finden. Dann hilft es,
gut zuzuhören (Jakobus 1:19).
1. Warum braucht jeder Ermunterung?
2-3. Wie können wir andere ermuntern, auch wenn uns die Worte fehlen?
WIE WÜRDEST DU ANTWORTEN?
• Was hast du gelernt?`;

describe("Wachtturm-Parser", () => {
  const parsed = parseWatchtowerText(SAMPLE_ARTICLE);
  it("erkennt Metadaten", () => {
    expect(parsed.studyNumber).toBe("48");
    expect(parsed.title).toBe("Wie wir einander im Alltag ermutigen können");
    expect(parsed.song).toContain("LIED 100");
  });
  it("ordnet Fragen den Absätzen zu (auch Bereiche)", () => {
    expect(parsed.paragraphs.map((p) => p.number)).toEqual(["1", "2-3"]);
    expect(parsed.paragraphs[0].question).toBe("Warum braucht jeder Ermunterung?");
    expect(parsed.paragraphs[0].scriptures).toEqual(["Sprüche 12:25"]);
    expect(parsed.paragraphs[1].originalText).toContain("[3]");
    expect(parsed.paragraphs[1].scriptures).toEqual(["Jakobus 1:19"]);
  });
  it("ignoriert den Wiederholungskasten", () => {
    expect(parsed.paragraphs.some((p) => p.question.includes("gelernt"))).toBe(false);
  });
});

const SAMPLE_WORKBOOK = `23.–29. NOVEMBER
JESAJA 58-59
SCHÄTZE AUS GOTTES WORT
1. Ein Beispielthema aus dem Bibelleseprogramm (10 Min.)
Beispieltext mit einem Gedanken (Jesaja 58:6).
2. Nach geistigen Schätzen graben (10 Min.)
Jesaja 58:13: Was lernen wir aus diesem Vers?
UNS IM DIENST VERBESSERN
4. Ein Gespräch beginnen (3 Min.)
Beispieltext für einen Gesprächsvorschlag.
UNSER LEBEN ALS CHRIST
7. Versammlungsbibelstudium (30 Min.)
Beispielkapitel, Absätze 1-5.`;

describe("Arbeitsheft-Parser", () => {
  const wb = parseWorkbookText(SAMPLE_WORKBOOK);
  it("teilt in Bereiche und Programmpunkte", () => {
    expect(wb.items.map((i) => [i.section, i.title])).toEqual([
      ["schaetze", "Ein Beispielthema aus dem Bibelleseprogramm"],
      ["schaetze", "Nach geistigen Schätzen graben"],
      ["dienst", "Ein Gespräch beginnen"],
      ["versammlungsbibelstudium", "Versammlungsbibelstudium"],
    ]);
    expect(wb.items[0].duration).toBe("10 Min.");
    expect(wb.items[1].questions[0]).toContain("Was lernen wir");
    expect(wb.bibleReading).toBe("JESAJA 58-59");
  });
});

describe("Wörtlichkeitsprüfung und Duplikate", () => {
  it("erkennt wörtliche und erfundene Auszüge", () => {
    const src = "Jeder von uns braucht hin und wieder Ermunterung. In diesem Beispielabsatz wird gezeigt, wie wichtig ein freundliches Wort ist.";
    expect(verbatimRatio("Jeder von uns braucht hin und wieder Ermunterung. In diesem Beispielabsatz wird gezeigt", src)).toBe(1);
    expect(verbatimRatio("Gott verlangt von uns, dass wir jeden Tag drei Stunden predigen und niemals ruhen", src)).toBe(0);
  });
  it("Inhalts-Hash ist robust gegenüber Formatierung", async () => {
    expect(await contentHash("Ein  Text,\nmit Umbruch")).toBe(await contentHash("ein text mit umbruch"));
  });
});
