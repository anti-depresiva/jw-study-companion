import { describe, expect, it } from "vitest";
import { findCongregationStudyUrl, findStudyArticleUrl, paragraphRange } from "@/lib/ai/wol";

const md = `# 23.–29. November
## UNSER LEBEN ALS CHRIST
8. Versammlungsbibelstudium (30 Min.)
[lfb Lektion 12 Abs. 1-7](/de/wol/pc/r10/lp-x/2026/12/0)
Schlussworte (3 Min.)
## Wachtturm-Studium
[Bleib nah bei Jehova](https://wol.jw.org/de/wol/d/r10/lp-x/2026440)`;

describe("WOL-Links", () => {
  it("findet den Stoff des Versammlungsbibelstudiums", () => {
    expect(findCongregationStudyUrl(md, "https://wol.jw.org/de/wol/meetings/r10/lp-x/2026/48")).toBe("https://wol.jw.org/de/wol/pc/r10/lp-x/2026/12/0");
  });
  it("ohne Versammlungsbibelstudium kein Link", () => {
    expect(findCongregationStudyUrl("nichts", "https://wol.jw.org/")).toBeNull();
  });
  it("findet weiterhin den Wachtturm-Artikel", () => {
    expect(findStudyArticleUrl(md, "https://wol.jw.org/")).toBe("https://wol.jw.org/de/wol/d/r10/lp-x/2026440");
  });
  it("liest den Absatzbereich", () => {
    expect(paragraphRange("lfb Lektion 12 Abs. 1-7")).toEqual([1, 7]);
    expect(paragraphRange("Kap. 3 Abs. 8–14")).toEqual([8, 14]);
    expect(paragraphRange("Lektion 12")).toBeNull();
  });
});
