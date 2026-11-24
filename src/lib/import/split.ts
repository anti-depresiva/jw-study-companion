/**
 * Ganze Ausgaben (mehrere Wochen) ohne KI zerlegen:
 *  - Arbeitsheft: Jede Woche beginnt mit einer Datumszeile wie „24.–30. NOVEMBER“
 *    oder „29. DEZEMBER 2025 – 4. JANUAR 2026“.
 *  - Wachtturm: Jeder Studienartikel beginnt mit „STUDIENARTIKEL 48“; die Studienwoche
 *    steht im Inhaltsverzeichnis bzw. am Artikelanfang als Datumsbereich.
 */
import { formatRange, isoWeekOf, weekRange } from "@/lib/week";
import { normalizeImportText } from "./text";

const MONTHS: Record<string, number> = {
  januar: 1, jänner: 1, jaenner: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};
const MONTH_RE = Object.keys(MONTHS).join("|");

/** „24.–30. NOVEMBER“, „24. – 30. November 2026“, „29. DEZEMBER 2025 – 4. JANUAR 2026“ */
const RANGE_RE = new RegExp(
  `(\\d{1,2})\\.\\s*(?:(${MONTH_RE})\\s*(\\d{4})?\\s*)?[–-]\\s*(\\d{1,2})\\.\\s*(${MONTH_RE})(?:\\s+(\\d{4}))?`,
  "i",
);

export interface FoundRange {
  /** ISO-Woche, zu der der Bereich gehört */
  year: number;
  week: number;
  label: string;
}

/** Erkennt einen Wochen-Datumsbereich in einem Text. `refYear` = Jahr der gewünschten Woche (für Angaben ohne Jahr). */
export function parseRange(text: string, refYear: number): FoundRange | null {
  const m = text.match(RANGE_RE);
  if (!m) return null;
  const startDay = Number(m[1]);
  const endMonth = MONTHS[m[5].toLowerCase()];
  const startMonth = m[2] ? MONTHS[m[2].toLowerCase()] : endMonth;
  const endYear = m[6] ? Number(m[6]) : m[3] ? Number(m[3]) : refYear;
  let startYear = m[3] ? Number(m[3]) : endYear;
  if (!m[3] && startMonth > endMonth) startYear = endYear - 1; // Dezember → Januar
  if (!startMonth || !endMonth || startDay < 1 || startDay > 31) return null;
  const start = `${startYear}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
  try {
    const iso = isoWeekOf(start);
    return { ...iso, label: m[0] };
  } catch {
    return null;
  }
}

/** Bei Angaben ohne Jahr: das Jahr wählen, das der gewünschten Woche am nächsten liegt. */
function closestRange(text: string, year: number, week: number): FoundRange | null {
  const candidates = [year - 1, year, year + 1].map((y) => parseRange(text, y)).filter(Boolean) as FoundRange[];
  const target = year * 53 + week;
  candidates.sort((a, b) => Math.abs(a.year * 53 + a.week - target) - Math.abs(b.year * 53 + b.week - target));
  return candidates[0] ?? null;
}

export interface WeekSplit {
  /** Anzahl erkannter Wochen in der Vorlage */
  weeks: FoundRange[];
  /** Text der gesuchten Woche (oder null, wenn nicht enthalten) */
  text: string | null;
}

/** Zerlegt ein Arbeitsheft in Wochen und liefert den Abschnitt der gewünschten Woche. */
export function splitWorkbookWeeks(raw: string, year: number, week: number): WeekSplit {
  const lines = normalizeImportText(raw).split("\n");
  const starts: Array<{ line: number; range: FoundRange }> = [];
  lines.forEach((line, i) => {
    const l = line.trim();
    // Datumszeile steht allein (evtl. mit Jahr) – keine Fließtextzeilen
    if (l.length > 45 || !RANGE_RE.test(l) || l.replace(RANGE_RE, "").trim().length > 6) return;
    const range = closestRange(l, year, week);
    if (range && !starts.some((s) => s.range.year === range.year && s.range.week === range.week)) starts.push({ line: i, range });
  });
  const idx = starts.findIndex((s) => s.range.year === year && s.range.week === week);
  if (idx < 0) return { weeks: starts.map((s) => s.range), text: null };
  const end = starts[idx + 1]?.line ?? lines.length;
  return { weeks: starts.map((s) => s.range), text: lines.slice(starts[idx].line, end).join("\n") };
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
    const m = l.trim().match(/^STUDIENARTIKEL\s+(\d{1,3})\b/i);
    if (m) marks.push({ line: i, number: m[1] });
  });
  if (marks.length === 0) return [];

  // Erstes Vorkommen jeder Nummer kann das Inhaltsverzeichnis sein → Datumsbereich in der Nähe suchen.
  const weekOf = new Map<string, FoundRange>();
  for (const mk of marks) {
    if (weekOf.has(mk.number)) continue;
    // Zuerst dieselbe Zeile und die Zeilen danach, erst dann davor (Datum kann je nach Layout vor/nach der Nummer stehen)
    const after = lines.slice(mk.line, mk.line + 4).join(" ").replace(/^.*?STUDIENARTIKEL\s+\d+/i, "");
    const nextMark = after.search(/STUDIENARTIKEL\s+\d+/i);
    const r =
      closestRange(nextMark >= 0 ? after.slice(0, nextMark) : after, year, week) ??
      closestRange(lines.slice(Math.max(0, mk.line - 2), mk.line).join(" "), year, week);
    if (r) weekOf.set(mk.number, r);
  }

  // Der eigentliche Artikel ist der längste Abschnitt je Nummer.
  const best = new Map<string, ArticleCandidate>();
  marks.forEach((mk, i) => {
    const end = marks[i + 1]?.line ?? lines.length;
    // zwei Zeilen davor gehören oft dazu (Lied, Titel stehen je nach Layout davor/danach)
    const body = lines.slice(Math.max(0, mk.line - 2), end).join("\n");
    const prev = best.get(mk.number);
    if (!prev || body.length > prev.text.length) {
      const title = lines.slice(mk.line + 1, mk.line + 6).map((l) => l.trim()).find((l) => l.length > 8 && !/^LIED\b/i.test(l) && !/[.:;,]$/.test(l)) ?? "";
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
