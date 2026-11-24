import { describe, expect, it } from "vitest";
import { findReferences } from "@/lib/references";
import { checkOfficialUrl } from "@/lib/sources/domain";

describe("Verweise auf Veröffentlichungen", () => {
  it("erkennt typische Verweise aus dem Arbeitsheft", () => {
    const refs = findReferences(
      "Sei dankbar (Klg 3:22; w24.01 30 Abs. 16). Geh kurz auf lmd Lektion 1 Punkt 4b ein. (th Lektion 12) wcg Kap. 18 und w25.12 26-30 – Thema",
    );
    expect(refs.map((r) => r.text)).toEqual(["w24.01 30 Abs. 16", "lmd Lektion 1 Punkt 4b", "th Lektion 12", "wcg Kap. 18", "w25.12 26-30"]);
    expect(refs[0].description).toBe("Der Wachtturm 01/2024, S. 30, Abs. 16");
    expect(refs.every((r) => checkOfficialUrl(r.url).ok)).toBe(true);
  });
  it("ignoriert normale Wörter und Bibelstellen", () => {
    expect(findReferences("Lies Klg 3:22. Wie viele Brüder kamen? 12 Personen. Das ist so.")).toEqual([]);
  });
});
