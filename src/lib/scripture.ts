/**
 * Erkennung und Normalisierung deutscher Bibelstellen (Neue-Welt-Übersetzung).
 * Wird genutzt, um KI-Antworten technisch gegen die Bibelstellen der
 * Originalquelle zu prüfen (keine erfundenen Bibelstellen).
 */

interface Book {
  id: number;
  name: string;
  /** Langformen ohne Zahl-Präfix */
  long: string[];
  /** Abkürzungen ohne Zahl-Präfix */
  abbr: string[];
  /** Zahl-Präfix (1., 2., 3.) */
  n?: number;
}

const B = (id: number, name: string, long: string[], abbr: string[], n?: number): Book => ({
  id,
  name,
  long,
  abbr,
  n,
});

export const BOOKS: Book[] = [
  B(1, "1. Mose", ["Mose"], ["Mo", "Mos"], 1),
  B(2, "2. Mose", ["Mose"], ["Mo", "Mos"], 2),
  B(3, "3. Mose", ["Mose"], ["Mo", "Mos"], 3),
  B(4, "4. Mose", ["Mose"], ["Mo", "Mos"], 4),
  B(5, "5. Mose", ["Mose"], ["Mo", "Mos"], 5),
  B(6, "Josua", ["Josua"], ["Jos"]),
  B(7, "Richter", ["Richter"], ["Ri"]),
  B(8, "Ruth", ["Ruth"], ["Rut"]),
  B(9, "1. Samuel", ["Samuel"], ["Sam", "Sa"], 1),
  B(10, "2. Samuel", ["Samuel"], ["Sam", "Sa"], 2),
  B(11, "1. Könige", ["Könige"], ["Kö", "Kön"], 1),
  B(12, "2. Könige", ["Könige"], ["Kö", "Kön"], 2),
  B(13, "1. Chronika", ["Chronika", "Chronik"], ["Ch", "Chr"], 1),
  B(14, "2. Chronika", ["Chronika", "Chronik"], ["Ch", "Chr"], 2),
  B(15, "Esra", ["Esra"], ["Esr"]),
  B(16, "Nehemia", ["Nehemia"], ["Ne", "Neh"]),
  B(17, "Esther", ["Esther"], ["Est"]),
  B(18, "Hiob", ["Hiob"], ["Hi"]),
  B(19, "Psalm", ["Psalmen", "Psalm"], ["Ps"]),
  B(20, "Sprüche", ["Sprüche"], ["Spr"]),
  B(21, "Prediger", ["Prediger"], ["Pr", "Pred"]),
  B(22, "Hohes Lied", ["Hohes Lied", "Hoheslied"], ["Hoh"]),
  B(23, "Jesaja", ["Jesaja"], ["Jes"]),
  B(24, "Jeremia", ["Jeremia"], ["Jer"]),
  B(25, "Klagelieder", ["Klagelieder"], ["Klg"]),
  B(26, "Hesekiel", ["Hesekiel"], ["Hes"]),
  B(27, "Daniel", ["Daniel"], ["Da", "Dan"]),
  B(28, "Hosea", ["Hosea"], ["Hos"]),
  B(29, "Joel", ["Joel"], ["Joe"]),
  B(30, "Amos", ["Amos"], ["Am"]),
  B(31, "Obadja", ["Obadja"], ["Ob"]),
  B(32, "Jona", ["Jona"], ["Jon"]),
  B(33, "Micha", ["Micha"], ["Mi"]),
  B(34, "Nahum", ["Nahum"], ["Na"]),
  B(35, "Habakuk", ["Habakuk"], ["Hab"]),
  B(36, "Zephanja", ["Zephanja"], ["Ze", "Zeph"]),
  B(37, "Haggai", ["Haggai"], ["Hag"]),
  B(38, "Sacharja", ["Sacharja"], ["Sach"]),
  B(39, "Maleachi", ["Maleachi"], ["Mal"]),
  B(40, "Matthäus", ["Matthäus"], ["Mat", "Mt"]),
  B(41, "Markus", ["Markus"], ["Mar", "Mk"]),
  B(42, "Lukas", ["Lukas"], ["Luk", "Lk"]),
  B(43, "Johannes", ["Johannes"], ["Joh"]),
  B(44, "Apostelgeschichte", ["Apostelgeschichte"], ["Apg"]),
  B(45, "Römer", ["Römer"], ["Rö", "Röm"]),
  B(46, "1. Korinther", ["Korinther"], ["Ko", "Kor"], 1),
  B(47, "2. Korinther", ["Korinther"], ["Ko", "Kor"], 2),
  B(48, "Galater", ["Galater"], ["Gal"]),
  B(49, "Epheser", ["Epheser"], ["Eph"]),
  B(50, "Philipper", ["Philipper"], ["Php", "Phil"]),
  B(51, "Kolosser", ["Kolosser"], ["Kol"]),
  B(52, "1. Thessalonicher", ["Thessalonicher"], ["Th", "Thes"], 1),
  B(53, "2. Thessalonicher", ["Thessalonicher"], ["Th", "Thes"], 2),
  B(54, "1. Timotheus", ["Timotheus"], ["Ti", "Tim"], 1),
  B(55, "2. Timotheus", ["Timotheus"], ["Ti", "Tim"], 2),
  B(56, "Titus", ["Titus"], ["Tit"]),
  B(57, "Philemon", ["Philemon"], ["Phm"]),
  B(58, "Hebräer", ["Hebräer"], ["Heb", "Hebr"]),
  B(59, "Jakobus", ["Jakobus"], ["Jak"]),
  B(60, "1. Petrus", ["Petrus"], ["Pe", "Petr"], 1),
  B(61, "2. Petrus", ["Petrus"], ["Pe", "Petr"], 2),
  B(62, "1. Johannes", ["Johannes"], ["Jo", "Joh"], 1),
  B(63, "2. Johannes", ["Johannes"], ["Jo", "Joh"], 2),
  B(64, "3. Johannes", ["Johannes"], ["Jo", "Joh"], 3),
  B(65, "Judas", ["Judas"], ["Jud"]),
  B(66, "Offenbarung", ["Offenbarung"], ["Off", "Offb"]),
];

interface Variant {
  text: string;
  book: number;
  /** Kurze Abkürzungen verlangen die Form Kapitel:Vers, um Fehltreffer wie „Am 5.“ zu vermeiden. */
  needsVerse: boolean;
}

function buildVariants(): Variant[] {
  const out: Variant[] = [];
  for (const b of BOOKS) {
    const forms: Array<[string, boolean]> = [
      ...b.long.map((l) => [l, false] as [string, boolean]),
      ...b.abbr.map((a) => [a, a.length <= 3] as [string, boolean]),
    ];
    for (const [form, short] of forms) {
      if (b.n) {
        for (const prefix of [`${b.n}. `, `${b.n}.`, `${b.n} `, `${b.n}`]) {
          out.push({ text: prefix + form, book: b.id, needsVerse: false });
        }
      } else {
        out.push({ text: form, book: b.id, needsVerse: short });
      }
    }
  }
  return out.sort((a, b) => b.text.length - a.text.length);
}

const VARIANTS = buildVariants();
const BY_TEXT = new Map(VARIANTS.map((v) => [v.text, v]));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const REF_RE = new RegExp(
  `(?<![\\p{L}\\d])(${VARIANTS.map((v) => escape(v.text)).join("|")})\\.?\\s?(\\d{1,3})` +
    `(?:\\s?:\\s?(\\d{1,3}(?:\\s?[-–]\\s?\\d{1,3})?(?:\\s?,\\s?\\d{1,3}(?:\\s?[-–]\\s?\\d{1,3})?)*))?` +
    `(?:\\s?[-–]\\s?(\\d{1,3})(?!\\s?:))?`,
  "gu",
);

export interface ScriptureRef {
  book: number;
  bookName: string;
  chapter: number;
  /** Bis-Kapitel bei Kapitelbereichen (z. B. Jesaja 58-59) */
  chapterEnd?: number;
  /** Einzelverse (Bereiche ausgeschrieben); leer = ganzes Kapitel */
  verses: number[];
  /** Normalisierte Schreibweise, z. B. „Johannes 3:16, 17“ */
  label: string;
}

function expandVerses(spec: string | undefined): number[] {
  if (!spec) return [];
  const out: number[] = [];
  for (const part of spec.split(",")) {
    const [a, b] = part.split(/[-–]/).map((s) => Number(s.trim()));
    if (!a) continue;
    if (b && b >= a && b - a < 200) for (let v = a; v <= b; v++) out.push(v);
    else out.push(a);
  }
  return [...new Set(out)].sort((x, y) => x - y);
}

function compactVerses(verses: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < verses.length) {
    let j = i;
    while (j + 1 < verses.length && verses[j + 1] === verses[j] + 1) j++;
    parts.push(j - i >= 2 ? `${verses[i]}-${verses[j]}` : verses.slice(i, j + 1).join(", "));
    i = j + 1;
  }
  return parts.join(", ");
}

export function findScriptures(text: string): ScriptureRef[] {
  const refs: ScriptureRef[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(REF_RE)) {
    const variant = BY_TEXT.get(m[1]);
    if (!variant) continue;
    const chapter = Number(m[2]);
    const verses = expandVerses(m[3]);
    const chapterEnd = !m[3] && m[4] ? Number(m[4]) : undefined;
    if (variant.needsVerse && verses.length === 0) continue;
    if (chapter < 1 || chapter > 150) continue;
    const book = BOOKS[variant.book - 1];
    const label =
      `${book.name} ${chapter}` +
      (chapterEnd ? `-${chapterEnd}` : "") +
      (verses.length ? `:${compactVerses(verses)}` : "");
    if (seen.has(label)) continue;
    seen.add(label);
    refs.push({ book: book.id, bookName: book.name, chapter, chapterEnd, verses, label });
  }
  return refs;
}

/** Ist `ref` durch eine der erlaubten Stellen abgedeckt? */
export function isCovered(ref: ScriptureRef, allowed: ScriptureRef[]): boolean {
  return allowed.some((a) => {
    if (a.book !== ref.book) return false;
    const aEnd = a.chapterEnd ?? a.chapter;
    const rEnd = ref.chapterEnd ?? ref.chapter;
    if (ref.chapter < a.chapter || rEnd > aEnd) return false;
    if (a.verses.length === 0) return true; // ganzes Kapitel erlaubt
    if (ref.chapter !== a.chapter || ref.chapterEnd) return false;
    if (ref.verses.length === 0) return false;
    return ref.verses.every((v) => a.verses.includes(v));
  });
}

/** Liefert alle Bibelstellen in `text`, die NICHT durch `allowed` abgedeckt sind. */
export function uncoveredScriptures(text: string, allowed: ScriptureRef[]): ScriptureRef[] {
  return findScriptures(text).filter((r) => !isCovered(r, allowed));
}

export function scriptureLabels(text: string): string[] {
  return findScriptures(text).map((r) => r.label);
}

/** Fundstellen mit Position im Text (für verlinkte Darstellung). */
export function scriptureSpans(text: string): Array<{ start: number; end: number; ref: ScriptureRef }> {
  const out: Array<{ start: number; end: number; ref: ScriptureRef }> = [];
  for (const m of text.matchAll(REF_RE)) {
    const refs = findScriptures(m[0]);
    if (refs.length && m.index !== undefined) out.push({ start: m.index, end: m.index + m[0].length, ref: refs[0] });
  }
  return out;
}
