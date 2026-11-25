import { findScriptures, scriptureLabels } from "@/lib/scripture";
import type { WorkbookSection } from "@/lib/types";
import { normalizeImportText } from "./text";

export interface ParsedParagraph {
  number: string;
  originalText: string;
  question: string;
  scriptures: string[];
}

export interface ParsedArticle {
  title: string;
  studyNumber: string | null;
  song: string | null;
  themeScripture: string | null;
  intro: string | null;
  paragraphs: ParsedParagraph[];
  warnings: string[];
}

export interface ParsedWorkbookItem {
  section: WorkbookSection;
  title: string;
  duration: string | null;
  originalText: string;
  questions: string[];
  scriptures: string[];
}

export interface ParsedWorkbook {
  title: string;
  bibleReading: string | null;
  items: ParsedWorkbookItem[];
  warnings: string[];
}

const PARA_START = /^(\d{1,2}) (?=[\p{Lu}„"(»‚'])/u;
const QUESTION_START = /^(\d{1,2}(?: ?[-–,] ?\d{1,2})?)\. (.+)$/;
const REVIEW_HEADER = /^(WIE WÜRDEST DU ANTWORTEN|WAS HAST DU GELERNT|WIE WÜRDEST DU ANTWORTEN\?)/i;

function expandNumbers(label: string): number[] {
  const parts = label.split(/[,]/).map((s) => s.trim());
  const out: number[] = [];
  for (const p of parts) {
    const [a, b] = p.split(/[-–]/).map((x) => Number(x.trim()));
    if (b && b >= a) for (let i = a; i <= b; i++) out.push(i);
    else if (a) out.push(a);
  }
  return out;
}

/** Heuristischer Parser für Wachtturm-Studienartikel (Text aus PDF oder Kopie). */
export function parseWatchtowerText(raw: string): ParsedArticle {
  const text = normalizeImportText(raw);
  const lines = text.split("\n").map((l) => l.trim());
  const warnings: string[] = [];

  const studyNumber = text.match(/STUDIENARTIKEL\s+(\d{1,3})/i)?.[1] ?? null;
  const song = text.match(/^LIED\s+\d{1,3}[^\n]*/im)?.[0]?.trim() ?? null;

  const head = lines.slice(0, 40);
  const themeLine = head.find((l) => /[„"»]/.test(l) && findScriptures(l).length > 0) ?? null;
  const title =
    head.find(
      (l) =>
        l.length >= 8 &&
        l.length <= 140 &&
        !/^(STUDIENARTIKEL|LIED|VORSCHAU|STUDIENAUSGABE|DER WACHTTURM)/i.test(l) &&
        !PARA_START.test(l) &&
        !QUESTION_START.test(l) &&
        l !== themeLine &&
        !/[.:;,]$/.test(l),
    ) ?? "";

  let intro: string | null = null;
  const vIdx = lines.findIndex((l) => /^VORSCHAU\b/i.test(l));
  if (vIdx >= 0) {
    const rest = lines.slice(vIdx).join(" ").replace(/^VORSCHAU:?\s*/i, "");
    intro = rest.split(/\s(?=1 [\p{Lu}„])/u)[0].slice(0, 600).trim() || null;
  }

  const paragraphs = new Map<number, string>();
  const questions: Array<{ label: string; text: string }> = [];
  let current: { kind: "p"; n: number } | { kind: "q"; i: number } | null = null;
  let inReview = false;

  for (const line of lines) {
    if (!line) continue;
    if (REVIEW_HEADER.test(line)) {
      inReview = true;
      current = null;
      continue;
    }
    if (inReview) continue;
    const q = line.match(QUESTION_START);
    // Im Studienartikel stehen Absätze als „3 Text…“, Fragen als „3. Frage…?“
    if (q) {
      questions.push({ label: q[1].replace(/\s/g, "").replace("–", "-"), text: q[2] });
      current = { kind: "q", i: questions.length - 1 };
      if (/\?\s*(\([^)]*\))?\s*$/.test(q[2])) current = null;
      continue;
    }
    const p = line.match(PARA_START);
    if (p) {
      const n = Number(p[1]);
      if (!paragraphs.has(n) && (paragraphs.size === 0 ? n === 1 : true)) {
        paragraphs.set(n, line.slice(p[0].length));
        current = { kind: "p", n };
        continue;
      }
    }
    if (current?.kind === "p") {
      paragraphs.set(current.n, `${paragraphs.get(current.n)} ${line}`);
    } else if (current?.kind === "q") {
      questions[current.i].text += ` ${line}`;
      if (/\?\s*(\([^)]*\))?\s*$/.test(line)) current = null;
    }
  }

  const units: ParsedParagraph[] = [];
  const used = new Set<number>();
  for (const q of questions) {
    const nums = expandNumbers(q.label).filter((n) => paragraphs.has(n));
    if (nums.length === 0) continue;
    nums.forEach((n) => used.add(n));
    const body = nums.map((n) => (nums.length > 1 ? `[${n}] ` : "") + paragraphs.get(n)).join("\n\n");
    units.push({
      number: nums.length > 1 ? `${nums[0]}-${nums[nums.length - 1]}` : String(nums[0]),
      originalText: body,
      question: q.text.trim(),
      scriptures: scriptureLabels(body),
    });
  }
  for (const [n, body] of paragraphs) {
    if (used.has(n)) continue;
    units.push({ number: String(n), originalText: body, question: "", scriptures: scriptureLabels(body) });
  }
  units.sort((a, b) => Number(a.number.split("-")[0]) - Number(b.number.split("-")[0]));

  if (!title) warnings.push("Kein Artikeltitel erkannt – bitte ergänzen.");
  if (units.length === 0) warnings.push("Keine nummerierten Absätze erkannt.");
  const withoutQ = units.filter((u) => !u.question).length;
  if (units.length && withoutQ) warnings.push(`${withoutQ} Absatz/Absätze ohne erkannte Originalfrage.`);

  return {
    title,
    studyNumber,
    song,
    themeScripture: themeLine,
    intro,
    paragraphs: units,
    warnings,
  };
}

const SECTION_HEADERS: Array<[RegExp, WorkbookSection]> = [
  [/^SCHÄTZE AUS GOTTES WORT/i, "schaetze"],
  [/^UNS IM DIENST VERBESSERN/i, "dienst"],
  [/^UNSER LEBEN ALS CHRIST/i, "leben"],
];
const ITEM_START = /^(\d{1,2})\. (.+)$/;
const DURATION = /\((\d{1,2}) ?Min\.?\)/i;
/** Kopfzeile einer Woche ohne Leerzeichen, evtl. mit Seitenzahl davor: „623.-29.NOVEMBERKLAGELIEDER3-5“ */
const WEEK_HEADER =
  /^\d{0,3}\.?(?:[A-ZÄÖÜ]+\d{0,4})?[-–]\d{1,2}\.(JANUAR|JÄNNER|FEBRUAR|MÄRZ|APRIL|MAI|JUNI|JULI|AUGUST|SEPTEMBER|OKTOBER|NOVEMBER|DEZEMBER)/;

/** Heuristischer Parser für eine Woche aus dem Arbeitsheft „Unser Leben und Dienst als Christ“. */
export function parseWorkbookText(raw: string): ParsedWorkbook {
  const text = normalizeImportText(raw);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const warnings: string[] = [];

  const head = lines.slice(0, 12);
  const dateLine = head.find((l) => /\d{1,2}\.?\s?[–-]\s?\d{1,2}\.?\s+[A-ZÄÖÜ]/i.test(l) && /\d/.test(l)) ?? null;
  const bibleReading =
    head.find((l) => l !== dateLine && findScriptures(l.replace(/\p{Lu}+/gu, (w) => w[0] + w.slice(1).toLowerCase())).length > 0) ??
    null;

  const items: ParsedWorkbookItem[] = [];
  let section: WorkbookSection = "schaetze";
  let current: ParsedWorkbookItem | null = null;

  const flush = () => {
    if (!current) return;
    current.originalText = current.originalText.trim();
    const sentences = current.originalText.match(/[^.!?\n]*\?/g) ?? [];
    current.questions = sentences.map((s) => s.trim()).filter((s) => s.length > 8);
    current.scriptures = scriptureLabels(`${current.title}\n${current.originalText}`);
    items.push(current);
    current = null;
  };

  let lastNumber = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ende des Wochenprogramms (Online-Bibliothek zeigt danach z. B. das Wachtturm-Studium)
    if (lastNumber >= 3 && /^(Schlussworte|Wachtturm-Studium|WACHTTURM-STUDIUM|Zusammenkunft am Wochenende)/.test(line)) {
      if (/^Schlussworte/.test(line)) continue;
      break;
    }
    // Kopfzeilen (Datum/Bibelbuch, oft im Sperrsatz) und reine Seitenzahlen überspringen
    if (WEEK_HEADER.test(line.replace(/\s+/g, "")) || /^\d{1,2}$/.test(line)) continue;
    const header = SECTION_HEADERS.find(([re]) => re.test(line));
    if (header) {
      flush();
      section = header[1];
      continue;
    }
    const m = line.match(ITEM_START);
    // Programmpunkte sind aufsteigend nummeriert (kleine Lücken bei Auszügen erlaubt) –
    // andere „6. …“-Zeilen mitten im Text sind kein neuer Punkt
    const n = m ? Number(m[1]) : 0;
    if (m && n > lastNumber && n <= lastNumber + 3 && n <= 9) {
      flush();
      lastNumber = n;
      let titleRaw = m[2];
      // Titel läuft oft bis zur Zeitangabe über 1–2 Folgezeilen: „1. Gib bei … nicht auf“ / „(10 Min.)“
      if (!DURATION.test(titleRaw)) {
        for (let k = 1; k <= 2 && i + k < lines.length; k++) {
          const next = lines[i + k];
          if (ITEM_START.test(next) || SECTION_HEADERS.some(([re]) => re.test(next))) break;
          if (DURATION.test(next)) {
            titleRaw = [titleRaw, ...lines.slice(i + 1, i + k + 1)].join(" ");
            i += k;
            break;
          }
        }
      }
      const dm = titleRaw.match(DURATION);
      const title = (dm ? titleRaw.slice(0, dm.index) : titleRaw).replace(/\s{2,}/g, " ").replace(/[\s:]+$/, "").trim();
      const after = dm ? titleRaw.slice((dm.index ?? 0) + dm[0].length).trim() : "";
      current = {
        section: /Versammlungsbibelstudium/i.test(title) ? "versammlungsbibelstudium" : section,
        title,
        duration: dm ? `${dm[1]} Min.` : null,
        originalText: after ? `${after}\n` : "",
        questions: [],
        scriptures: [],
      };
      continue;
    }
    if (current) current.originalText += `${line}\n`;
  }
  flush();

  if (items.length === 0) warnings.push("Keine nummerierten Programmpunkte erkannt.");
  return {
    title: dateLine ? `Arbeitsheft – Woche ${dateLine}` : "Arbeitsheft „Unser Leben und Dienst als Christ“",
    bibleReading,
    items,
    warnings,
  };
}
