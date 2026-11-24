/** Bereinigt aus PDF oder Zwischenablage kopierten Text. */
export function normalizeImportText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/­/g, "") // weiche Trennstriche
    .replace(/[​-‍﻿]/g, "")
    .replace(/([a-zäöüß])-\n([a-zäöüß])/g, "$1$2") // Silbentrennung am Zeilenende
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
