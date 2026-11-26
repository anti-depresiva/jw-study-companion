import { describe, expect, it } from "vitest";
import { workbookContext } from "@/lib/ai/prompts";
import type { Workbook } from "@/lib/types";

describe("KI-Kontext des Arbeitshefts", () => {
  it("enthält den Stoff des Versammlungsbibelstudiums", () => {
    const wb = {
      title: "Woche",
      bibleReading: null,
      items: [
        {
          id: "i8",
          section: "versammlungsbibelstudium",
          position: 8,
          title: "Versammlungsbibelstudium",
          duration: "30 Min.",
          originalText: "wcg Kap. 19",
          questions: [],
          scriptures: [],
          material: {
            title: "Kapitel 19",
            url: "https://wol.jw.org/de/wol/pc/r10/lp-x/1/10/0",
            paragraphs: [
              { number: "", question: "", text: "Kapiteltext hier." },
              { number: "", question: "Was zeigt der Bericht?", text: "" },
            ],
          },
        },
      ],
    } as unknown as Workbook;
    const ctx = workbookContext(wb);
    expect(ctx).toContain("Kapiteltext hier.");
    expect(ctx).toContain("Was zeigt der Bericht?");
  });
});
