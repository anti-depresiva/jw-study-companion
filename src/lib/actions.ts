/**
 * Alle Aktionen der App laufen direkt im Browser des Geräts.
 * Daten: IndexedDB (lokal). KI: direkte Anfrage an die Anthropic-API.
 */
import { z } from "zod";
import { generateAnswerSet, generateComments } from "@/lib/ai/answers";
import { askAssistant, lookupReference as lookupReferenceAi, type ChatTurn } from "@/lib/ai/assistant";
import { aiEnabled, configureAi, model } from "@/lib/ai/client";
import { findReferences } from "@/lib/references";
import { extractArticleWithAi, extractWorkbookWithAi } from "@/lib/ai/extract";
import { store } from "@/lib/data";
import { parseWatchtowerText, parseWorkbookText, type ParsedArticle, type ParsedWorkbook } from "@/lib/import/parse";
import { extractPdfText } from "@/lib/import/pdf";
import { extractPageImages, type PdfImage } from "@/lib/import/images";
import { comparable, contentHash, normalizeImportText, verbatimRatio } from "@/lib/import/text";
import { scriptureLabels } from "@/lib/scripture";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { checkWeek, isPreparing, prepareWeekAnswers } from "@/lib/study/prepare";
import { resolveTarget } from "@/lib/study/targets";
import type { AnswerSet, Favorite, Settings, SourceKind, TargetType, Variant } from "@/lib/types";
import { currentWeek, formatRange, weekRange } from "@/lib/week";
import { describeWeeks, splitWatchtowerArticles, splitWorkbookPages, splitWorkbookWeeks } from "@/lib/import/split";
import { notifyChange } from "@/lib/client/use-data";

export class UserError extends Error {}

export interface Target {
  weekId: string;
  targetType: TargetType;
  targetId: string;
}

/** Lädt die Einstellungen und richtet den KI-Zugang ein. */
async function withAi() {
  const settings = await store.getSettings();
  configureAi(settings.anthropicKey, settings.anthropicModel);
  return settings;
}

export async function isAiReady() {
  await withAi();
  return aiEnabled();
}

/* ── Woche vorbereiten ───────────────────────────────────────────── */

export async function prepareWeek(opts: { year?: number; week?: number; force?: boolean; onProgress?: (weekId: string) => void } = {}) {
  const settings = await withAi();
  const cw = currentWeek();
  const result = await checkWeek(store, opts.year ?? cw.year, opts.week ?? cw.week, { search: settings.useWebSearch });
  const [article, workbook] = await Promise.all([store.getArticle(result.week.id), store.getWorkbook(result.week.id)]);
  const hasContent = Boolean(article || workbook);
  notifyChange();
  let run: Promise<void> | null = null;
  if (hasContent && !isPreparing(result.week.id)) {
    run = prepareWeekAnswers(store, result.week.id, {
      force: opts.force,
      onProgress: () => opts.onProgress?.(result.week.id),
    }).finally(notifyChange);
  }
  return { week: result.week, notes: result.notes, hasContent, run };
}

/* ── KI ──────────────────────────────────────────────────────────── */

export async function generateAnswers(t: Target, mode: "generate" | "regenerate"): Promise<AnswerSet> {
  const settings = await withAi();
  const target = await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  const previous = await store.getAnswer(t.targetType, t.targetId);
  let answer = await generateAnswerSet(store, target, settings);
  if (mode === "regenerate" && previous) {
    const now = new Date().toISOString();
    const kept = [previous.short, previous.detailed, previous.personal].map((text) => ({
      id: crypto.randomUUID(),
      kind: "variante" as const,
      text,
      scriptures: previous.scriptures,
      createdAt: now,
    }));
    answer = await store.saveAnswer({ ...answer, extraComments: [...answer.extraComments, ...kept] });
  }
  notifyChange();
  return answer;
}

export async function moreComments(t: Target): Promise<AnswerSet> {
  const settings = await withAi();
  const target = await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  const answer = await generateComments(store, target, settings);
  notifyChange();
  return answer;
}

export async function ask(t: Target, messages: ChatTurn[]) {
  if (!messages.length || messages[0].role !== "user" || messages.at(-1)!.role !== "user") {
    throw new UserError("Der Verlauf muss mit einer Frage beginnen und enden.");
  }
  const settings = await withAi();
  const target = await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  return askAssistant(target, messages.slice(-20), settings.useWebSearch);
}

/* ── Fortschritt, Notizen, Favoriten, Einstellungen ─────────────── */

export async function setPrepared(t: Target, prepared: boolean) {
  await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  await store.setProgress({ ...t, prepared });
  notifyChange();
}

export async function saveNote(t: Target, text: string) {
  if (text.length > 20000) throw new UserError("Die Notiz ist zu lang.");
  await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  return store.saveNote({ ...t, text });
}

export async function addFavorite(t: Target, f: { variant: Variant | "comment"; label: string; text: string }): Promise<Favorite> {
  const target = await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  const fav = await store.addFavorite({ ...t, ...f, href: target.href });
  notifyChange();
  return fav;
}

export async function removeFavorite(id: string) {
  await store.removeFavorite(id);
  notifyChange();
}

export async function saveSettings(patch: Partial<Settings>) {
  const s = await store.saveSettings(patch);
  notifyChange();
  return s;
}

/* ── Quellen ─────────────────────────────────────────────────────── */

export async function addSource(input: { weekId: string; title: string; kind: SourceKind; url: string }) {
  const check = checkOfficialUrl(input.url);
  if (!check.ok) throw new UserError(check.reason);
  if (!input.title.trim()) throw new UserError("Bitte einen Titel angeben.");
  if (!(await store.getWeekById(input.weekId))) throw new UserError("Woche nicht gefunden.");
  const res = await store.addSource({
    weekId: input.weekId,
    title: input.title.trim().slice(0, 300),
    kind: input.kind,
    url: check.url,
    publishedAt: null,
    verification: "user_confirmed",
    origin: "manual",
    contentHash: null,
    note: "Manuell verknüpft.",
  });
  if (!res.duplicate) {
    const imp = (await store.listSources(input.weekId)).find((s) => s.kind === input.kind && s.verification === "user_import" && !s.url);
    if (imp) await store.updateSource(imp.id, { url: check.url });
  }
  notifyChange();
  return res;
}

export async function setSourceVerification(id: string, verification: "user_confirmed" | "rejected") {
  const source = (await store.listSources()).find((s) => s.id === id);
  if (!source) throw new UserError("Quelle nicht gefunden.");
  if (source.verification === "user_import") throw new UserError("Importierte Quellen werden über den Import verwaltet.");
  await store.updateSource(id, { verification });
  notifyChange();
}

export async function deleteSource(id: string) {
  const source = (await store.listSources()).find((s) => s.id === id);
  if (!source) throw new UserError("Quelle nicht gefunden.");
  if (source.verification === "user_import") throw new UserError("Importierte Quellen können nicht einzeln gelöscht werden.");
  await store.deleteSource(id);
  notifyChange();
}

/* ── Import ──────────────────────────────────────────────────────── */

const MAX_TEXT = 600_000;

export interface ImportPreview {
  method: "heuristic" | "ai";
  origin: "pdf" | "text";
  pages: number | null;
  chars: number;
  contentHash: string;
  duplicate: boolean;
  parsed: ParsedArticle | ParsedWorkbook;
  notes: string[];
  /** Bei Wachtturm-Ausgaben mit mehreren Studienartikeln */
  articleChoices: Array<{ number: string; title: string; weekLabel: string | null }>;
  /** Bilder aus den PDF-Seiten dieser Woche (noch nicht gespeichert) */
  images: PdfImage[];
}

export async function previewImport(input: {
  kind: "watchtower" | "workbook";
  weekId: string;
  ai: "auto" | "on" | "off";
  file?: File | null;
  text?: string;
  /** Gewählter Studienartikel (Nummer) bei ganzen Ausgaben */
  article?: string;
}): Promise<ImportPreview> {
  const week = await store.getWeekById(input.weekId);
  if (!week) throw new UserError("Woche nicht gefunden.");
  let raw: string;
  let origin: "pdf" | "text";
  let pages: number | null = null;
  let pageTexts: string[] | null = null;
  let doc: Awaited<ReturnType<typeof extractPdfText>>["doc"] | null = null;
  if (input.file) {
    const pdf = await extractPdfText(input.file);
    doc = pdf.doc;
    raw = pdf.text;
    pages = pdf.pages;
    pageTexts = pdf.pageTexts;
    origin = "pdf";
  } else {
    raw = input.text ?? "";
    origin = "text";
  }
  if (raw.length > MAX_TEXT) throw new UserError("Der Text ist zu lang (max. 600 000 Zeichen).");
  const text = normalizeImportText(raw);
  if (text.length < 200) throw new UserError("Zu wenig Text gefunden. Bitte den vollständigen Abschnitt verwenden.");

  const range = weekRange(week.year, week.week);
  const label = `KW ${week.week} (${formatRange(range.start, range.end)})`;
  const notes: string[] = [];
  const aiReady = await isAiReady();
  let articleChoices: ImportPreview["articleChoices"] = [];

  // 1) Ganze Ausgaben ohne KI zerlegen: nur den Teil der gewünschten Woche verwenden.
  let part = text;
  let containsWeek = true;
  let weekBibleReading: string | null = null;
  let weekPages: number[] = pageTexts ? pageTexts.map((_, i) => i + 1) : [];
  if (input.kind === "workbook") {
    const byPage = pageTexts && pageTexts.length > 1 ? splitWorkbookPages(pageTexts, week.year, week.week) : null;
    const split = byPage && byPage.weeks.length >= 2 ? byPage : splitWorkbookWeeks(text, week.year, week.week);
    if (split.weeks.length >= 2) {
      if (split.text) {
        part = split.text;
        weekBibleReading = split.bibleReading;
        if (split.pageNumbers.length) weekPages = split.pageNumbers;
        notes.push(`Die Datei enthält ${split.weeks.length} Wochen – übernommen wird ${label}. Die anderen Wochen kannst du dort mit derselben Datei importieren.`);
      } else {
        containsWeek = false;
        if (!aiReady) throw new UserError(`${label} ist in dieser Datei nicht enthalten. Enthalten sind: ${describeWeeks(split.weeks)}.`);
      }
    }
  } else {
    const cands = splitWatchtowerArticles(text, week.year, week.week);
    if (cands.length >= 2) {
      articleChoices = cands.map((c) => ({
        number: c.number,
        title: c.title,
        weekLabel: c.week ? describeWeeks([c.week]) : null,
      }));
      const chosen =
        (input.article && cands.find((c) => c.number === input.article)) ||
        cands.find((c) => c.week?.year === week.year && c.week.week === week.week);
      if (chosen) {
        part = chosen.text;
        if (pageTexts) weekPages = pagesOf(pageTexts, part);
        notes.push(`Die Ausgabe enthält ${cands.length} Studienartikel – übernommen wird Studienartikel ${chosen.number}.`);
      } else if (!aiReady) {
        part = cands[0].text;
        if (pageTexts) weekPages = pagesOf(pageTexts, part);
        notes.push(`Die Ausgabe enthält ${cands.length} Studienartikel; die Studienwoche wurde nicht automatisch erkannt. Bitte oben den richtigen Artikel wählen.`);
      } else {
        containsWeek = false;
      }
    }
  }

  // 2) Textmuster-Erkennung; KI nur, wenn nötig (oder ausdrücklich gewünscht).
  let method: ImportPreview["method"] = "heuristic";
  let parsed: ParsedArticle | ParsedWorkbook = input.kind === "watchtower" ? parseWatchtowerText(part) : parseWorkbookText(part);
  const poor =
    input.kind === "watchtower"
      ? (parsed as ParsedArticle).paragraphs.filter((p) => p.question).length < 3
      : (parsed as ParsedWorkbook).items.length < 3 || (parsed as ParsedWorkbook).items.length > 15;
  const wantAi = input.ai === "on" || (input.ai === "auto" && (poor || !containsWeek));
  if (wantAi && aiReady) {
    parsed = input.kind === "watchtower" ? await extractArticleWithAi(part, range) : await extractWorkbookWithAi(part, range);
    method = "ai";
  } else if (wantAi && poor) {
    notes.push("Die Struktur wurde nicht sicher erkannt. Mit API-Schlüssel (Einstellungen) erkennt die KI sie zuverlässiger – oder bitte unten prüfen und ergänzen.");
  }

  if (input.kind === "workbook" && method === "heuristic") {
    const wb = parsed as ParsedWorkbook;
    // Kopfzeile der Woche liefert Bibelleseprogramm und einen sauberen Titel
    if (weekBibleReading) wb.bibleReading = weekBibleReading;
    if (part !== text || !wb.title.includes("Woche")) wb.title = `Woche ${formatRange(range.start, range.end)}`;
  }

  const items = input.kind === "watchtower" ? (parsed as ParsedArticle).paragraphs.length : (parsed as ParsedWorkbook).items.length;
  if (items > (input.kind === "watchtower" ? 80 : 40)) {
    throw new UserError("Es wurden ungewöhnlich viele Abschnitte erkannt – vermutlich enthält die Datei mehrere Wochen, deren Datumszeilen nicht gefunden wurden. Bitte nur den Text der gewünschten Woche einfügen.");
  }

  // 3) Bilder der betreffenden Seiten (nur bei PDF, nur auf dem Gerät)
  let images: PdfImage[] = [];
  if (doc && weekPages.length && containsWeek) {
    try {
      images = await extractPageImages(doc, weekPages);
      if (images.length) notes.push(`${images.length} Bild(er) aus der PDF gefunden – sie werden mitgespeichert.`);
    } catch {
      notes.push("Die Bilder konnten nicht aus der PDF gelesen werden; der Text wird trotzdem übernommen.");
    }
  }

  const hash = await contentHash(part);
  const duplicate = (await store.listSources(week.id)).some((s) => s.contentHash === hash);
  return { method, origin, pages, chars: part.length, contentHash: hash, duplicate, parsed, notes, articleChoices, images };
}

/** PDF-Seiten, deren Text im gewählten Abschnitt vorkommt. */
function pagesOf(pageTexts: string[], part: string): number[] {
  return pageTexts.flatMap((p, i) => {
    const sample = comparable(normalizeImportText(p)).split(" ").slice(0, 60).join(" ");
    return sample.length > 80 && verbatimRatio(sample, part, 5) >= 0.5 ? [i + 1] : [];
  });
}

const s = (max: number) => z.string().max(max);
const opt = (max: number) => z.string().max(max).nullable().optional();

const ArticleData = z.object({
  title: s(300).min(1, "Titel fehlt"),
  studyNumber: opt(10),
  issue: opt(100),
  publishedAt: opt(100),
  themeScripture: opt(1000),
  song: opt(200),
  intro: opt(3000),
  paragraphs: z.array(z.object({ number: s(10).min(1), originalText: s(20000).min(1), question: s(2000) })).min(1, "Mindestens ein Absatz").max(80, "Zu viele Absätze (max. 80) – bitte nur einen Studienartikel importieren."),
});

const WorkbookData = z.object({
  title: s(300).min(1, "Titel fehlt"),
  bibleReading: opt(200),
  items: z
    .array(
      z.object({
        section: z.enum(["schaetze", "dienst", "leben", "versammlungsbibelstudium"]),
        title: s(300).min(1),
        duration: opt(20),
        originalText: s(20000),
        questions: z.array(s(2000)).max(30),
      }),
    )
    .min(1, "Mindestens ein Programmpunkt")
    .max(40, "Zu viele Programmpunkte (max. 40) – bitte nur eine Woche importieren."),
});

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export class DuplicateImportError extends UserError {}

export async function saveImport(input: {
  weekId: string;
  kind: "watchtower" | "workbook";
  origin: "pdf" | "text" | "manual";
  contentHash: string | null;
  sourceUrl: string | null;
  overwrite: boolean;
  data: unknown;
  /** Bilder aus der PDF (ersetzen die bisherigen Bilder dieser Woche) */
  images?: PdfImage[];
}) {
  const week = await store.getWeekById(input.weekId);
  if (!week) throw new UserError("Woche nicht gefunden.");
  let url: string | null = null;
  if (input.sourceUrl?.trim()) {
    const check = checkOfficialUrl(input.sourceUrl);
    if (!check.ok) throw new UserError(check.reason);
    url = check.url;
  }
  const existing = input.kind === "watchtower" ? await store.getArticle(week.id) : await store.getWorkbook(week.id);
  if (existing && !input.overwrite) throw new DuplicateImportError("Für diese Woche ist bereits ein Inhalt importiert.");
  const sources = await store.listSources(week.id);
  if (input.contentHash && !input.overwrite && sources.some((x) => x.contentHash === input.contentHash)) {
    throw new DuplicateImportError("Diese Veröffentlichung wurde bereits importiert.");
  }
  const importUrl = url && sources.some((x) => x.url === url) ? null : url;

  const registerSource = async (title: string, kind: "watchtower" | "workbook", publishedAt: string | null) => {
    const res = await store.addSource({
      weekId: week.id,
      title,
      kind,
      url: importUrl,
      publishedAt,
      verification: "user_import",
      origin: input.origin,
      contentHash: input.contentHash,
      note: "Inhalt vom Benutzer importiert.",
    });
    if (res.duplicate) await store.updateSource(res.source.id, { title, publishedAt });
    return res.source;
  };

  if (input.kind === "watchtower") {
    const d = ArticleData.safeParse(input.data);
    if (!d.success) throw new UserError(d.error.issues[0]?.message ?? "Ungültige Artikeldaten.");
    const source = await registerSource(`Wachtturm-Studienartikel: ${d.data.title}`, "watchtower", clean(d.data.issue) ?? clean(d.data.publishedAt));
    await store.saveArticle({
      weekId: week.id,
      title: d.data.title.trim(),
      studyNumber: clean(d.data.studyNumber),
      issue: clean(d.data.issue),
      publishedAt: clean(d.data.publishedAt),
      themeScripture: clean(d.data.themeScripture),
      song: clean(d.data.song),
      intro: clean(d.data.intro),
      imageUrl: null,
      sourceId: source.id,
      sourceUrl: url,
      paragraphs: d.data.paragraphs.map((p, i) => ({
        position: i + 1,
        number: p.number.trim(),
        originalText: p.originalText.trim(),
        question: p.question.trim(),
        scriptures: scriptureLabels(p.originalText),
      })),
    });
  } else {
    const d = WorkbookData.safeParse(input.data);
    if (!d.success) throw new UserError(d.error.issues[0]?.message ?? "Ungültige Arbeitsheftdaten.");
    const source = await registerSource(`Arbeitsheft-Woche: ${d.data.title}`, "workbook", null);
    await store.saveWorkbook({
      weekId: week.id,
      title: d.data.title.trim(),
      bibleReading: clean(d.data.bibleReading),
      sourceId: source.id,
      sourceUrl: url,
      items: d.data.items.map((it, i) => ({
        section: it.section,
        position: i + 1,
        title: it.title.trim(),
        duration: clean(it.duration),
        originalText: it.originalText.trim(),
        questions: it.questions.map((q) => q.trim()).filter(Boolean),
        scriptures: scriptureLabels(`${it.title}\n${it.originalText}`),
      })),
    });
  }
  if (input.images) {
    await store.replaceImages(week.id, input.kind, input.images.map(({ page, width, height, blob }) => ({ page, width, height, blob })));
  }
  await store.updateWeek(week.id, { status: "importiert" });
  notifyChange();
}

/* ── Verweise nachschlagen ───────────────────────────────────────── */

export async function lookupReference(t: Target, referenceText: string) {
  await withAi();
  const target = await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  const ref = findReferences(`${target.originalText}\n${target.question}`).find((r) => r.text === referenceText);
  if (!ref) throw new UserError("Dieser Verweis kommt im Abschnitt nicht vor.");
  const result = await lookupReferenceAi(target, ref);
  if (!result.found) return { saved: null, message: result.text };
  const saved = await store.saveLookup({
    ...t,
    reference: ref.text,
    text: result.text,
    sources: result.sources,
    warnings: result.warnings,
    model: model(),
  });
  notifyChange();
  return { saved, message: null };
}

export async function deleteLookup(id: string) {
  await store.deleteLookup(id);
  notifyChange();
}
