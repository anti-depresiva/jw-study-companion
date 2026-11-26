export type Theme = "system" | "light" | "dark";
export type Variant = "short" | "detailed" | "personal";
export type CommentLength = "kurz" | "mittel" | "lang";
export type TargetType = "paragraph" | "workbook_item";

export interface Settings {
  displayName: string;
  bibleTranslation: "nwtsty" | "nwt";
  language: "de";
  theme: Theme;
  fontScale: number; // 0.9 … 1.4
  defaultVariant: Variant;
  autoWeekCheck: boolean;
  notifications: boolean;
  commentLength: CommentLength;
  midweekDay: number; // 1 = Montag … 7 = Sonntag
  weekendDay: number;
  useWebSearch: boolean; // jw.org-beschränkte Suche zur Quellenerkennung
  anthropicKey: string; // bleibt nur auf diesem Gerät
  anthropicModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  bibleTranslation: "nwtsty",
  language: "de",
  theme: "system",
  fontScale: 1,
  defaultVariant: "short",
  autoWeekCheck: true,
  notifications: false,
  commentLength: "mittel",
  midweekDay: 3,
  weekendDay: 7,
  useWebSearch: true,
  anthropicKey: "",
  anthropicModel: "claude-opus-5-5",
};

export type WeekStatus = "leer" | "quellen_erkannt" | "importiert" | "vorbereitet";

export interface PrepJob {
  state: "idle" | "running" | "done" | "error";
  done: number;
  total: number;
  message: string;
  updatedAt: string;
}

export interface Week {
  id: string;
  year: number;
  week: number;
  start: string;
  end: string;
  status: WeekStatus;
  prepJob: PrepJob | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

export type SourceKind = "workbook" | "watchtower" | "bible" | "other";
export type Verification =
  | "unverified_pattern" // aus bekanntem Linkmuster erzeugt
  | "verified_link" // Linkprüfung erfolgreich (HTTP 200 auf jw.org)
  | "verified_search" // von der jw.org-beschränkten Suche gefunden
  | "user_confirmed" // vom Benutzer bestätigt
  | "user_import" // Inhalt vom Benutzer importiert (Text/manuell)
  | "rejected";
export type SourceOrigin = "pattern" | "search" | "manual" | "pdf" | "text" | "wol";

export interface Source {
  id: string;
  weekId: string | null;
  title: string;
  kind: SourceKind;
  url: string | null;
  publishedAt: string | null;
  verification: Verification;
  origin: SourceOrigin;
  contentHash: string | null;
  note: string | null;
  createdAt: string;
}

export type WorkbookSection = "schaetze" | "dienst" | "leben" | "versammlungsbibelstudium";

export const SECTION_TITLES: Record<WorkbookSection, string> = {
  schaetze: "Schätze aus Gottes Wort",
  dienst: "Uns im Dienst verbessern",
  leben: "Unser Leben als Christ",
  versammlungsbibelstudium: "Versammlungsbibelstudium",
};

export interface WorkbookItem {
  id: string;
  workbookId: string;
  section: WorkbookSection;
  position: number;
  title: string;
  duration: string | null;
  originalText: string;
  questions: string[];
  scriptures: string[];
  /** Studienmaterial (z. B. Versammlungsbibelstudium), von der verlinkten WOL-Seite geladen */
  material?: StudyMaterial | null;
  /** Verweise im Text (z. B. „th Lektion 2“, Bibelstellen) mit Link in die Online-Bibliothek */
  links?: RefLink[];
}

/** Verweis mit Link auf wol.jw.org / jw.org */
export interface RefLink {
  label: string;
  url: string;
}

/** Verlinktes Studienmaterial eines Programmpunkts – Originaltext von wol.jw.org. */
export interface StudyMaterial {
  title: string;
  url: string;
  paragraphs: Array<{ number: string; question: string; text: string }>;
  /** Verweise in den Fragen des Stoffs (z. B. „it ‚Jephtha‘ Abs. 6“) */
  links?: RefLink[];
}

/** Alle Fragen eines Programmpunkts – eigene Fragen, dann die Fragen des Studienmaterials. */
export function itemQuestions(item: Pick<WorkbookItem, "questions" | "material">): string[] {
  return [...item.questions, ...(item.material?.paragraphs ?? []).map((p) => p.question).filter((q) => q.trim())];
}

/** Text eines Programmpunkts inkl. Studienmaterial (für KI-Antworten). */
export function itemFullText(item: Pick<WorkbookItem, "originalText" | "material">): string {
  const m = item.material;
  if (!m?.paragraphs.length) return item.originalText;
  const body = m.paragraphs.map((p) => `${p.question ? `${p.question}\n` : ""}${p.number ? `${p.number} ` : ""}${p.text}`).join("\n\n");
  return `${item.originalText}\n\nStudienmaterial: ${m.title}\n\n${body}`;
}

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple" | "orange";

/** Textmarker-Markierung in einem Textblock der Wochenseite. */
export interface Highlight {
  id: string;
  weekId: string;
  /** Stabiler Schlüssel des Textblocks (bleibt beim Neuladen der Woche gleich) */
  block: string;
  start: number;
  end: number;
  /** Markierter Text – zur Kontrolle, falls sich der Text ändert */
  text: string;
  color: HighlightColor;
  createdAt: string;
}

export interface Workbook {
  id: string;
  weekId: string;
  title: string;
  bibleReading: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  items: WorkbookItem[];
  createdAt: string;
}

export interface Paragraph {
  id: string;
  articleId: string;
  position: number;
  number: string; // „3“ oder „4-5“
  originalText: string;
  question: string;
  scriptures: string[];
}

export interface Article {
  id: string;
  weekId: string;
  title: string;
  studyNumber: string | null;
  issue: string | null;
  publishedAt: string | null;
  themeScripture: string | null;
  song: string | null;
  intro: string | null;
  imageUrl: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  paragraphs: Paragraph[];
  createdAt: string;
}

export interface SourceRef {
  publication: string; // z. B. „Der Wachtturm (Studienausgabe)“
  title: string; // Artikel- oder Programmpunkt-Titel
  section: string; // „Absatz 3“
  date: string | null;
  url: string | null;
  verification: Verification | null;
  scriptures: string[];
  userImported: boolean;
}

export type CommentKind = "blickwinkel" | "bibelstelle" | "alltag" | "erkenntnis" | "natuerlich" | "variante";

export const COMMENT_KIND_LABELS: Record<CommentKind, string> = {
  blickwinkel: "Anderer Blickwinkel",
  bibelstelle: "Bibelstelle im Mittelpunkt",
  alltag: "Anwendung im Alltag",
  erkenntnis: "Besondere Erkenntnis",
  natuerlich: "Natürlich formuliert",
  variante: "Weitere Antwort",
};

export interface ExtraComment {
  id: string;
  kind: CommentKind;
  text: string;
  scriptures: string[];
  createdAt: string;
}

export interface AnswerSet {
  id: string;
  targetType: TargetType;
  targetId: string;
  weekId: string;
  short: string;
  detailed: string;
  personal: string;
  extraThought: string;
  scriptures: string[];
  sourceRef: SourceRef;
  warnings: string[];
  extraComments: ExtraComment[];
  model: string;
  generatedAt: string;
}

export interface Note {
  targetType: TargetType;
  targetId: string;
  weekId: string;
  text: string;
  updatedAt: string;
}

export interface Favorite {
  id: string;
  targetType: TargetType;
  targetId: string;
  weekId: string;
  label: string; // z. B. „Wachtturm · Absatz 3 · Kurze Antwort“
  variant: Variant | "comment";
  text: string;
  href: string;
  createdAt: string;
}

export interface ProgressEntry {
  weekId: string;
  targetType: TargetType;
  targetId: string;
  prepared: boolean;
  updatedAt: string;
}

/** Ergebnis von „Claude schlägt nach“ zu einem Verweis (z. B. „w24.01 30 Abs. 16“). */
export interface Lookup {
  id: string;
  weekId: string;
  targetType: TargetType;
  targetId: string;
  reference: string;
  text: string;
  sources: Array<{ title: string; url: string }>;
  warnings: string[];
  model: string;
  createdAt: string;
}

/** Antwortfeld unter einer Frage (wie die grauen Felder in der Online-Bibliothek). */
export interface AnswerField {
  weekId: string;
  targetType: TargetType;
  targetId: string;
  /** Index der Frage innerhalb des Programmpunkts (bei Absätzen immer 0) */
  index: number;
  text: string;
  origin: "ai" | "user";
  updatedAt: string;
}
