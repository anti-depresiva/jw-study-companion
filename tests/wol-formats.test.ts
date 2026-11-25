import { describe, expect, it } from "vitest";
import {
  cleanFetchedText,
  findCongregationStudyUrl,
  findStudyArticleUrl,
} from "@/lib/ai/wol";
import { parseChapterMaterial, parseWatchtowerText } from "@/lib/import/parse";

const LONG =
  "Dies ist ein ausreichend langer Beispielabsatz, damit er als richtiger Fließtext erkannt wird und nicht als Überschrift.";

describe("Wachtturm im Format der Online-Bibliothek (Frage vor dem Absatz)", () => {
  const md = `**1. JANUAR 2027**

# **Ein Beispieltitel**

**1.** Was ist die erste Frage? ([Joh. 3:16](/de/wol/bc/r10/lp-x/1/0/0)).

Deine Antwort

${LONG} Absatz eins.

**2-3.** (a) Zweite Frage? (b) Dritte Frage?

Deine Antworten

**2** ${LONG} Absatz zwei.

**3** ${LONG} Absatz drei.

## **EINE ZWISCHENÜBERSCHRIFT4.** Vierte Frage mit Bild? (Siehe auch das Bild.)

Deine Antwort

**4** ${LONG} Absatz vier.`;

  it("erkennt unnummerierten ersten Absatz, Fragengruppen und Überschriften", () => {
    const a = parseWatchtowerText(cleanFetchedText(md));
    expect(a.paragraphs.map((p) => p.number)).toEqual(["1", "2-3", "4"]);
    expect(a.paragraphs.every((p) => p.question)).toBe(true);
    expect(a.paragraphs[0].originalText).toMatch(/Absatz eins\.$/);
    expect(a.paragraphs[0].question).not.toMatch(/Deine Antwort/);
    expect(a.paragraphs[2].question).toMatch(/^Vierte Frage/);
    expect(a.paragraphs[1].originalText).not.toMatch(/ZWISCHENÜBERSCHRIFT/);
  });
});

describe("Kapitel ohne Absatznummern (Versammlungsbibelstudium)", () => {
  const md = `### **12 EIN KAPITELTITEL**

Gedruckte Ausgabe

${LONG} Erster.

${LONG} Zweiter.

Zum Nachlesen in der Bibel:

[Richter 1:1](/de/wol/bc/x)

### **Für Gespräche:Was zeigt der Bericht?**

Deine Antwort

## **Tauch tiefer ein1.Wieso war das so? ([it „Name“ Abs. 2](/de/wol/pc/x))** **(A)**

Deine Antwort

Bild A: Beschreibung des Bildes

Lerne aus dem Bericht

Wie kann ich das anwenden?

Deine Antwort

Mehr dazu

Wie kann das helfen?`;

  it("übernimmt Fließtext und alle Fragen", () => {
    const m = parseChapterMaterial(cleanFetchedText(md));
    expect(m.paragraphs.filter((p) => p.text)).toHaveLength(2);
    expect(
      m.paragraphs.filter((p) => p.question).map((p) => p.question),
    ).toEqual([
      "Was zeigt der Bericht?",
      "1. Wieso war das so? (it „Name“ Abs. 2) (A)",
      "Wie kann ich das anwenden?",
    ]);
  });
});

describe("Links der Online-Bibliothek", () => {
  it("findet das Versammlungsbibelstudium trotz weichem Trennstrich", () => {
    const md = `### **8. Versammlungs­bibelstudium**\n\n(30 Min.) [wcg Kap. 19](/de/wol/pc/r10/lp-x/202026405/10/0)\n\nSchlussworte (3 Min.)`;
    expect(
      findCongregationStudyUrl(
        md,
        "https://wol.jw.org/de/wol/meetings/r10/lp-x/2026/49",
      ),
    ).toBe("https://wol.jw.org/de/wol/pc/r10/lp-x/202026405/10/0");
  });

  it("wählt den Wachtturm-Artikel statt der Arbeitsheft-Woche", () => {
    const md = `Wachtturm-Studium\n\n[Arbeitsheft](/de/wol/d/r10/lp-x/202026405)\n\n[Wehr dich](/de/wol/d/r10/lp-x/2026566)`;
    expect(
      findStudyArticleUrl(
        md,
        "https://wol.jw.org/de/wol/meetings/r10/lp-x/2026/49",
      ),
    ).toBe("https://wol.jw.org/de/wol/d/r10/lp-x/2026566");
  });
});
