/**
 * Ganze Ausgaben (mehrere Wochen) ohne KI zerlegen.
 *
 * Arbeitsheft-PDFs von jw.org: Jede Woche beginnt auf einer neuen Seite mit einer
 * Kopfzeile wie „2 3 . - 2 9. N OVEMB ER KLAG E LI E D E R 3 - 5“ (Sperrsatz, oft mit
 * vorangestellter Seitenzahl „6“). Die Textreihenfolge im PDF entspricht nicht immer
 * der Leserichtung – die Kopfzeile kann am Seitenende stehen. Deshalb wird bei PDFs
 * seitenweise zerlegt; bei eingefügtem Text zeilenweise.
 */
import { formatRange, isoWeekOf, weekRange } from "@/lib/week";
import { normalizeImportText, squash } from "./text";

const MONTHS: Record<string, number> = {
  JANUAR: 1, JÄNNER: 1, JAENNER: 1, FEBRUAR: 2, MÄRZ: 3, MAERZ: 3, APRIL: 4, MAI: 5, JUNI: 6,
  JULI: 7, AUGUST: 8, SEPTEMBER: 9, OKTOBER: 10, NOVEMBER: 11, DEZEMBER: 12,
};
const M = Object.keys(MONTHS).join("|");

/** Auf Text ohne Leerzeichen: „23.-29.NOVEMBER“, „30.NOVEMBER–6.DEZEMBER“, „29.DEZEMBER2025–4.JANUAR2026“ */
const RANGE = new RegExp(`(\\d{1,3})\\.(?:(${M})(\\d{4})?)?[-–](\\d{1,2})\\.(${M})(\\d{4})?`, "i");

export interface FoundRange {
  year: number;
  week: number;
  label: string;
  bibleReading: string | null;
}

/** Tag aus Ziffern mit evtl. angeklebter Seitenzahl („623“ → 23, „169“ → 9). */
function day(digits: string): number {
  for (const len of [2, 1]) {
    const d = Number(digits.slice(-len));
    if (d >= 1 && d <= 31) return d;
  }
  return 0;
}

function titleCase(word: string) {
  return word.charAt(0) + word.slice(1).toLowerCase();
}

/** Erkennt einen Wochen-Datumsbereich (auch in Sperrsatz). `refYear` = Jahr für Angaben ohne Jahreszahl. */
export function parseRange(text: string, refYear: number): FoundRange | null {
  const s = squash(text).toUpperCase();
  const m = s.match(RANGE);
  if (!m || m.index === undefined) return null;
  const startDay = day(m[1]);
  const endMonth = MONTHS[m[5].toUpperCase()];
  const startMonth = m[2] ? MONTHS[m[2].toUpperCase()] : endMonth;
  const endYear = m[6] ? Number(m[6]) : m[3] ? Number(m[3]) : refYear;
  let startYear = m[3] ? Number(m[3]) : endYear;
  if (!m[3] && startMonth > endMonth) startYear = endYear - 1; // Dezember → Januar
  if (!startDay || !startMonth || !endMonth) return null;
  let iso;
  try {
    iso = isoWeekOf(`${startYear}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`);
  } catch {
    return null;
  }
  // Bibelleseprogramm direkt hinter dem Datum: „KLAGELIEDER3-5“, „1.KÖNIGE1-2“
  const rest = s.slice(m.index + m[0].length);
  const book = rest.match(/^([1-3]\.?[A-ZÄÖÜ]+|[A-ZÄÖÜ]{3,})(\d{1,3}(?:[-–]\d{1,3})?)/);
  const bibleReading = book ? `${book[1].replace(/^([1-3])\.?/, "$1. ").replace(/[A-ZÄÖÜ]+/, titleCase)} ${book[2]}` : null;
  return { ...iso, label: m[0], bibleReading };
}

/** Bei Angaben ohne Jahr: das Jahr wählen, das der gewünschten Woche am nächsten liegt. */
function closestRange(text: string, year: number, week: number): FoundRange | null {
  const candidates = [year - 1, year, year + 1].map((y) => parseRange(text, y)).filter(Boolean) as FoundRange[];
  const target = year * 53 + week;
  candidates.sort((a, b) => Math.abs(a.year * 53 + a.week - target) - Math.abs(b.year * 53 + b.week - target));
  return candidates[0] ?? null;
}

/** Eine Kopfzeile ist kurz, beginnt mit dem Datum (evtl. nach Seitenzahl) und enthält sonst nur das Bibelbuch. */
function headerOf(line: string, year: number, week: number): FoundRange | null {
  const s = squash(line);
  if (s.length < 8 || s.length > 60) return null;
  const m = s.toUpperCase().match(RANGE);
  if (!m || (m.index ?? 99) > 3) return null;
  return closestRange(line, year, week);
}

export interface WeekSplit {
  weeks: FoundRange[];
  text: string | null;
  bibleReading: string | null;
}

const same = (a: FoundRange, year: number, week: number) => a.year === year && a.week === week;

/** PDF: seitenweise zerlegen. Seiten ohne Kopfzeile gehören zur vorherigen Woche. */
export function splitWorkbookPages(pages: string[], year: number, week: number): WeekSplit {
  const weeks: Array<{ range: FoundRange; pages: string[] }> = [];
  let current: (typeof weeks)[number] | null = null;
  for (const raw of pages) {
    const page = normalizeImportText(raw);
    const lines = page.split("\n");
    const header = lines.map((l) => headerOf(l, year, week)).find(Boolean) ?? null;
    const startsWeek = /^1\. /m.test(page);
    if (header && startsWeek) {
      current = { range: header, pages: [page] };
      if (!weeks.some((w) => same(w.range, header.year, header.week))) weeks.push(current);
    } else if (header) {
      current = null; // z. B. Rückseite mit Hinweis auf eine Woche – keine Wochenseite
    } else if (current) {
      current.pages.push(page);
    }
  }
  const hit = weeks.find((w) => same(w.range, year, week));
  return {
    weeks: weeks.map((w) => w.range),
    text: hit ? hit.pages.join("\n") : null,
    bibleReading: hit?.range.bibleReading ?? null,
  };
}

/** Eingefügter Text: zeilenweise zerlegen. */
export function splitWorkbookWeeks(raw: string, year: number, week: number): WeekSplit {
  const lines = normalizeImportText(raw).split("\n");
  const starts: Array<{ line: number; range: FoundRange }> = [];
  lines.forEach((line, i) => {
    const range = headerOf(line, year, week);
    if (range && !starts.some((s) => same(s.range, range.year, range.week))) starts.push({ line: i, range });
  });
  const idx = starts.findIndex((s) => same(s.range, year, week));
  if (idx < 0) return { weeks: starts.map((s) => s.range), text: null, bibleReading: null };
  const end = starts[idx + 1]?.line ?? lines.length;
  return {
    weeks: starts.map((s) => s.range),
    text: lines.slice(starts[idx].line, end).join("\n"),
    bibleReading: starts[idx].range.bibleReading,
  };
}

export interface ArticleCandidate {
  number: string;
  week: FoundRange | null;
  text: string;
  title: string;
}

/** Zerlegt eine Wachtturm-Studienausgabe in Studienartikel und ordnet ihnen (wenn möglich) die Studienwoche zu. */
export function splitWatchtowerArticles(raw: string, year: number, week: number): ArticleCandidate[] {
  const text = normalizeImportText(raw);
  const lines = text.split("\n");
  const marks: Array<{ line: number; number: string }> = [];
  lines.forEach((l, i) => {
    const m = squash(l).match(/^(?:\d{1,2})?STUDIENARTIKEL(\d{1,3})(?!\d)/i);
    if (m) marks.push({ line: i, number: m[1] });
  });
  if (marks.length === 0) return [];

  const weekOf = new Map<string, FoundRange>();
  for (const mk of marks) {
    if (weekOf.has(mk.number)) continue;
    // Zuerst dieselbe Zeile und die Zeilen danach, erst dann davor
    const after = lines.slice(mk.line, mk.line + 4).join(" ").replace(/^.*?STUDIENARTIKEL\s*\d+/i, "");
    const nextMark = after.search(/STUDIENARTIKEL\s*\d+/i);
    const r =
      closestRange(nextMark >= 0 ? after.slice(0, nextMark) : after, year, week) ??
      closestRange(lines.slice(Math.max(0, mk.line - 2), mk.line).join(" "), year, week);
    if (r) weekOf.set(mk.number, r);
  }

  const best = new Map<string, ArticleCandidate>();
  marks.forEach((mk, i) => {
    const end = marks[i + 1]?.line ?? lines.length;
    const body = lines.slice(Math.max(0, mk.line - 2), end).join("\n");
    const prev = best.get(mk.number);
    if (!prev || body.length > prev.text.length) {
      const title =
        lines
          .slice(mk.line + 1, mk.line + 6)
          .map((l) => l.trim())
          .find((l) => l.length > 8 && !/^LIED\b/i.test(l) && !/[.:;,]$/.test(l)) ?? "";
      best.set(mk.number, { number: mk.number, week: weekOf.get(mk.number) ?? null, text: body, title });
    }
  });
  return [...best.values()].filter((c) => c.text.length > 400);
}

export function describeWeeks(weeks: FoundRange[]): string {
  return weeks
    .map((w) => {
      const r = weekRange(w.year, w.week);
      return `KW ${w.week} (${formatRange(r.start, r.end)})`;
    })
    .join(", ");
}
