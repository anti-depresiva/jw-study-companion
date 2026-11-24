/**
 * Erkennt Verweise auf andere Veröffentlichungen im Studientext, z. B.
 * „w24.01 30 Abs. 16“, „lmd Lektion 5 Punkt 4“, „th Lektion 12“, „wcg Kap. 18“.
 */
import { checkOfficialUrl } from "@/lib/sources/domain";

/** Zeitschriften mit Ausgabe: w24.01 (Wachtturm), g23.2 (Erwachet!), wp, mwb */
const ISSUE = String.raw`(?:w|g|wp|mwb)\d{2}\.\d{1,2}`;
/** Bekannte Kurzsymbole (Kleinbuchstaben, mit Bindestrich-Bänden wie it-1) */
const SYMBOL = String.raw`(?:lmd|lff|lfb|th|wcg|bt|cl|ia|jy|kr|lv|bh|bhs|rr|si|scl|od|be|sjj|jl|rs|lvs|it-[12]|ip-[12]|ijwbq|ijwfq|ijwbv|ijwyp|ijwwd|ijwhf|nwtsty)`;
const LOCATOR = String.raw`(?:Lektion\s+\d{1,3}(?:\s+Punkt\s+\d{1,2}[a-z]?)?|Kap\.\s*\d{1,3}(?:\s+Abs\.\s*\d{1,3}(?:-\d{1,3})?)?|Artikel\s+\d{1,3}|Frage\s+\d{1,3}|Anhang\s+[A-Z](?:\s+Punkt\s+\d{1,2})?|Abs\.\s*\d{1,3}(?:-\d{1,3})?|\d{1,4}(?:-\d{1,4})?(?:\s+Abs\.\s*\d{1,3}(?:-\d{1,3})?)?)`;

const REF_RE = new RegExp(String.raw`(?<![\p{L}\d-])((?:${ISSUE}|${SYMBOL}))\s+(${LOCATOR})`, "gu");

export interface Reference {
  /** Originalschreibweise, z. B. „w24.01 30 Abs. 16“ */
  text: string;
  symbol: string;
  locator: string;
  /** Lesbare Beschreibung, soweit sicher bekannt */
  description: string;
  /** Suche in der Online-Bibliothek von jw.org */
  url: string;
}

function describe(symbol: string, locator: string): string {
  const issue = symbol.match(/^(w|g|wp|mwb)(\d{2})\.(\d{1,2})$/);
  if (issue) {
    const name = { w: "Der Wachtturm", g: "Erwachet!", wp: "Der Wachtturm (öffentliche Ausgabe)", mwb: "Arbeitsheft" }[issue[1]];
    const page = locator.match(/^(\d{1,4}(?:-\d{1,4})?)/)?.[1];
    const para = locator.match(/Abs\.\s*([\d-]+)/)?.[1];
    return [`${name} ${issue[3].padStart(2, "0")}/20${issue[2]}`, page && `S. ${page}`, para && `Abs. ${para}`].filter(Boolean).join(", ");
  }
  return `${symbol} ${locator}`;
}

export function findReferences(text: string): Reference[] {
  const out: Reference[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(REF_RE)) {
    const ref = `${m[1]} ${m[2]}`.replace(/\s+/g, " ").trim();
    if (seen.has(ref)) continue;
    seen.add(ref);
    const url = `https://wol.jw.org/de/wol/l/r10/lp-x?q=${encodeURIComponent(ref)}`;
    if (!checkOfficialUrl(url).ok) continue;
    out.push({ text: ref, symbol: m[1], locator: m[2], description: describe(m[1], m[2]), url });
  }
  return out;
}
