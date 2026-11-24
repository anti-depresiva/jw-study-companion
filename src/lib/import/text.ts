const ch = (n: number) => String.fromCharCode(n);
/** Steuerzeichen (z. B. aus Zierlinien und Symbol-Schriften in PDFs) außer Tab und Zeilenumbruch */
const CONTROL = new RegExp(`[${ch(0)}-${ch(8)}${ch(11)}${ch(12)}${ch(14)}-${ch(31)}${ch(127)}]`, "g");
/** In manchen PDFs steht das Umlaut-Zeichen getrennt vor dem Vokal, oft sogar über einen Zeilenumbruch: „SCH ¨\nATZE“ */
const LOOSE_UMLAUT = new RegExp(`(\\p{L}*)([ \\t]*)[${ch(0xa8)}${ch(0x308)}][ \\t]*\\n?[ \\t]*([aouAOU])(?=(\\p{L}*))`, "gu");
const UMLAUT: Record<string, string> = { a: "ä", o: "ö", u: "ü", A: "Ä", O: "Ö", U: "Ü" };
/** Wörter, die mit Umlaut beginnen – davor stand ein echtes Leerzeichen („Sprich über“, „zu überleben“) */
const STARTS_WORD = /^(über|übr|übl|übung|ähnl|älte|änder|äuß|ärger|öffentl|öl)/i;
/** … außer in Zusammensetzungen („gegenüber“, „darüber“) */
const COMPOUND_PREFIX = /(gegen|dar|hin|her|vor|wor|drüber|hier)$/i;

function fixUmlaut(_: string, pre: string, ws: string, vowel: string, rest: string) {
  const u = UMLAUT[vowel];
  if (!pre) return ws + u;
  if (STARTS_WORD.test(u + rest) && !COMPOUND_PREFIX.test(pre)) return `${pre} ${u}`;
  return pre + u;
}

/** Bereinigt aus PDF oder Zwischenablage kopierten Text. */
export function normalizeImportText(raw: string): string {
  return raw
    .replace(CONTROL, "")
    .replace(LOOSE_UMLAUT, fixUmlaut)
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/­/g, "") // weiche Trennstriche
    .replace(/[​-‍﻿]/g, "")
    .replace(/([a-zäöüß])-\n([a-zäöüß])/g, "$1$2") // Silbentrennung am Zeilenende
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Zweizeilige Bereichsüberschriften im Arbeitsheft zusammenführen
    .replace(/SCHÄTZE\s*\n\s*AUS GOTTES WORT/g, "SCHÄTZE AUS GOTTES WORT")
    .replace(/UNS IM DIENST\s*\n\s*VERBESSERN/g, "UNS IM DIENST VERBESSERN")
    .replace(/UNSER LEBEN\s*\n\s*ALS CHRIST/g, "UNSER LEBEN ALS CHRIST")
    .trim();
}

/** Entfernt Sperrsatz („N OVEMB ER“ → „NOVEMBER“) für die Erkennung von Kopfzeilen. */
export function squash(line: string): string {
  return line.replace(/\s+/g, "");
}

/** Vergleichsform: nur Buchstaben/Ziffern, Kleinbuchstaben, einfache Leerzeichen. */
export function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[„“”"'‚‘’«»]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export async function contentHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(comparable(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Anteil der Wort-n-Gramme aus `excerpt`, die wörtlich in `source` vorkommen.
 * 1.0 = vollständig wörtlich enthalten. Damit wird technisch geprüft, dass
 * ein als „Originaltext“ gespeicherter Absatz wirklich aus der Quelle stammt.
 */
export function verbatimRatio(excerpt: string, source: string, n = 6): number {
  const words = comparable(excerpt).split(" ").filter(Boolean);
  if (words.length === 0) return 0;
  const src = ` ${comparable(source)} `;
  if (words.length < n) return src.includes(` ${words.join(" ")} `) ? 1 : 0;
  let hits = 0;
  let total = 0;
  for (let i = 0; i + n <= words.length; i += Math.max(1, Math.floor(n / 2))) {
    total++;
    if (src.includes(` ${words.slice(i, i + n).join(" ")} `)) hits++;
  }
  return total ? hits / total : 0;
}
