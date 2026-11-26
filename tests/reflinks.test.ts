import { describe, expect, it } from "vitest";
import { extractRefLinks, linksIn } from "@/lib/ai/wol";

const BASE = "https://wol.jw.org/de/wol/d/r10/lp-x/202026405";

describe("Verweis-Links", () => {
  const md = `### **3. Bibellesung**

(4 Min.) [Hes 2:1-10](/de/wol/bc/r10/lp-x/202026405/4/0) ([th Lektion 2](/de/wol/pc/r10/lp-x/202026405/4/0))

[Lied 63](/de/wol/pc/r10/lp-x/202026405/9/0) [10](/de/wol/bc/r10/lp-x/202026405/3/1)

[Bild](/de/wol/d/r10/lp-x/202026405/thumbnail) [Fremd](https://example.com/wol/pc/1)`;

  it("übernimmt Veröffentlichungs- und Bibelverweise, ohne Lieder, Zahlen und fremde Seiten", () => {
    const links = extractRefLinks(md, BASE);
    expect(links.map((l) => l.label)).toEqual(["Hes 2:1-10", "th Lektion 2"]);
    expect(links[1].url).toBe(
      "https://wol.jw.org/de/wol/pc/r10/lp-x/202026405/4/0",
    );
  });

  it("ordnet Verweise dem Text zu, in dem sie vorkommen", () => {
    const links = extractRefLinks(md, BASE);
    expect(linksIn("(4 Min.) Hes 2:1-10 (th Lektion 2)", links)).toHaveLength(
      2,
    );
    expect(linksIn("Gespräche beginnen", links)).toHaveLength(0);
  });
});
