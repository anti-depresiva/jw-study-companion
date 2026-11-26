/**
 * Alle Aktionen der App laufen direkt im Browser des Geräts.
 * Daten: IndexedDB (lokal). KI: direkte Anfrage an die Anthropic-API.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { generateAnswerSet, generateComments, generateFieldAnswers, type ReferenceText } from "@/lib/ai/answers";
import { askAssistant, lookupReference as lookupReferenceAi, type ChatTurn } from "@/lib/ai/assistant";
import { aiEnabled, configureAi, friendlyError, model } from "@/lib/ai/client";
import {
  cleanFetchedText,
  extractRefLinks,
  fetchJwPage,
  findCongregationStudyUrl,
  findStudyArticleUrl,
  findWorkbookWeekUrl,
  linksIn,
  paragraphRange,
  type FetchedPage,
} from "@/lib/ai/wol";
import { wolMeetingsUrl } from "@/lib/sources/links";
import { findReferences } from "@/lib/references";
import { extractArticleWithAi, extractMaterialWithAi, extractWorkbookWithAi } from "@/lib/ai/extract";
import { store } from "@/lib/data";
import { parseChapterMaterial, parseWatchtowerText, parseWorkbookText, type ParsedArticle, type ParsedWorkbook } from "@/lib/import/parse";
import { contentHash, normalizeImportText } from "@/lib/import/text";
import { scriptureLabels } from "@/lib/scripture";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { checkWeek, isPreparing, prepareWeekAnswers } from "@/lib/study/prepare";
import { resolveTarget } from "@/lib/study/targets";
import type { AnswerSet, Favorite, Highlight, RefLink, Settings, SourceKind, StudyMaterial, TargetType, Variant, WorkbookItem } from "@/lib/types";
import { itemQuestions } from "@/lib/types";
import { currentWeek, formatRange, weekRange } from "@/lib/week";
import { describeWeeks, splitWatchtowerArticles, splitWorkbookWeeks } from "@/lib/import/split";
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

export async function prepareWeek(
  opts: {
    year?: number;
    week?: number;
    force?: boolean;
    onProgress?: (weekId: string) => void;
  } = {},
) {
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
    answer = await store.saveAnswer({
      ...answer,
      extraComments: [...answer.extraComments, ...kept],
    });
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
  origin: "text";
  chars: number;
  contentHash: string;
  duplicate: boolean;
  parsed: ParsedArticle | ParsedWorkbook;
  notes: string[];
  /** Bei Wachtturm-Ausgaben mit mehreren Studienartikeln */
  articleChoices: Array<{
    number: string;
    title: string;
    weekLabel: string | null;
  }>;
}

export async function previewImport(input: {
  kind: "watchtower" | "workbook";
  weekId: string;
  ai: "auto" | "on" | "off";
  text: string;
  /** Gewählter Studienartikel (Nummer) bei ganzen Ausgaben */
  article?: string;
}): Promise<ImportPreview> {
  const week = await store.getWeekById(input.weekId);
  if (!week) throw new UserError("Woche nicht gefunden.");
  const raw = input.text ?? "";
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
  if (input.kind === "workbook") {
    const split = splitWorkbookWeeks(text, week.year, week.week);
    if (split.weeks.length >= 2) {
      if (split.text) {
        part = split.text;
        weekBibleReading = split.bibleReading;
        notes.push(
          `Die Datei enthält ${split.weeks.length} Wochen – übernommen wird ${label}. Die anderen Wochen kannst du dort mit demselben Text importieren.`,
        );
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
        (input.article && cands.find((c) => c.number === input.article)) || cands.find((c) => c.week?.year === week.year && c.week.week === week.week);
      if (chosen) {
        part = chosen.text;
        notes.push(`Die Ausgabe enthält ${cands.length} Studienartikel – übernommen wird Studienartikel ${chosen.number}.`);
      } else if (!aiReady) {
        part = cands[0].text;
        notes.push(
          `Die Ausgabe enthält ${cands.length} Studienartikel; die Studienwoche wurde nicht automatisch erkannt. Bitte oben den richtigen Artikel wählen.`,
        );
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
    notes.push(
      "Die Struktur wurde nicht sicher erkannt. Mit API-Schlüssel (Einstellungen) erkennt die KI sie zuverlässiger – oder bitte unten prüfen und ergänzen.",
    );
  }

  if (input.kind === "workbook" && method === "heuristic") {
    const wb = parsed as ParsedWorkbook;
    // Kopfzeile der Woche liefert Bibelleseprogramm und einen sauberen Titel
    if (weekBibleReading) wb.bibleReading = weekBibleReading;
    if (part !== text || !wb.title.includes("Woche")) wb.title = `Woche ${formatRange(range.start, range.end)}`;
  }

  const items = input.kind === "watchtower" ? (parsed as ParsedArticle).paragraphs.length : (parsed as ParsedWorkbook).items.length;
  if (items > (input.kind === "watchtower" ? 80 : 40)) {
    throw new UserError(
      "Es wurden ungewöhnlich viele Abschnitte erkannt – vermutlich enthält die Datei mehrere Wochen, deren Datumszeilen nicht gefunden wurden. Bitte nur den Text der gewünschten Woche einfügen.",
    );
  }

  const hash = await contentHash(part);
  const duplicate = (await store.listSources(week.id)).some((s) => s.contentHash === hash);
  return {
    method,
    origin: "text",
    chars: part.length,
    contentHash: hash,
    duplicate,
    parsed,
    notes,
    articleChoices,
  };
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
  paragraphs: z
    .array(
      z.object({
        number: s(10).min(1),
        originalText: s(20000).min(1),
        question: s(2000),
      }),
    )
    .min(1, "Mindestens ein Absatz")
    .max(80, "Zu viele Absätze (max. 80) – bitte nur einen Studienartikel importieren."),
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
        material: z
          .object({
            title: s(300),
            url: s(500),
            paragraphs: z.array(z.object({ number: s(10), question: s(2000), text: s(20000) })).max(120),
            links: z
              .array(z.object({ label: s(200), url: s(500) }))
              .max(60)
              .optional(),
          })
          .nullable()
          .optional(),
        links: z
          .array(z.object({ label: s(200), url: s(500) }))
          .max(60)
          .optional(),
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
  origin: "text" | "manual" | "wol";
  contentHash: string | null;
  sourceUrl: string | null;
  overwrite: boolean;
  data: unknown;
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
  // Direkt von wol.jw.org abgerufen = geprüfte offizielle Quelle; sonst vom Benutzer importiert
  const verification = input.origin === "wol" ? ("verified_link" as const) : ("user_import" as const);
  if (input.origin === "wol" && url) {
    for (const x of sources.filter((x) => x.url === url && x.verification === "unverified_pattern")) {
      await store.updateSource(x.id, {
        verification: "verified_link",
        note: "Seite erfolgreich abgerufen.",
      });
    }
  }

  const registerSource = async (title: string, kind: "watchtower" | "workbook", publishedAt: string | null) => {
    const res = await store.addSource({
      weekId: week.id,
      title,
      kind,
      url: importUrl,
      publishedAt,
      verification,
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
        material: it.material && checkOfficialUrl(it.material.url).ok ? { ...it.material, links: officialLinks(it.material.links) } : null,
        links: officialLinks(it.links),
      })),
    });
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

/* ── Woche direkt von wol.jw.org laden (Abruf durch Claude) ──────── */

export interface WolImportResult {
  workbookItems: number;
  paragraphs: number;
  articleTitle: string | null;
  notes: string[];
}

/**
 * Lädt die Zusammenkünfte-Seite der Woche aus der Online-Bibliothek und den dort
 * verlinkten Wachtturm-Studienartikel. Übernommen wird der Originaltext der Seiten.
 */
export async function importFromWol(
  year: number,
  isoWeek: number,
  opts: { overwrite?: boolean; onStep?: (msg: string) => void } = {},
): Promise<WolImportResult> {
  await withAi();
  if (!aiEnabled()) throw new UserError("Für das Laden von wol.jw.org wird der Anthropic-API-Schlüssel benötigt (Einstellungen).");
  const week = await store.ensureWeek(year, isoWeek);
  const range = weekRange(year, isoWeek);
  const notes: string[] = [];
  const [hasWorkbook, hasArticle] = await Promise.all([store.getWorkbook(week.id), store.getArticle(week.id)]);
  if ((hasWorkbook || hasArticle) && !opts.overwrite) {
    throw new DuplicateImportError("Für diese Woche sind bereits Inhalte vorhanden.");
  }

  // 1) Arbeitsheft-Woche
  opts.onStep?.("Lade die Woche aus der Online-Bibliothek …");
  const meetingsUrl = wolMeetingsUrl(year, isoWeek);
  const page = await fetchJwPage(meetingsUrl);
  let wbPage = page;
  let text = normalizeImportText(cleanFetchedText(page.text));
  let workbook = parseWorkbookText(text);

  // Die Wochenseite zeigt oft nur Links – das Programm steht auf der verlinkten Arbeitsheft-Woche
  const workbookUrl = workbook.items.length < 3 ? findWorkbookWeekUrl(page.text, page.url) : null;
  if (workbookUrl) {
    opts.onStep?.("Lade das Arbeitsheft-Programm …");
    try {
      wbPage = await fetchJwPage(workbookUrl);
      text = normalizeImportText(cleanFetchedText(wbPage.text));
      workbook = parseWorkbookText(text);
    } catch (err) {
      notes.push(`Arbeitsheft-Woche: ${friendlyError(err)}`);
    }
  }
  if (text.length < 300) throw new UserError("Die Seite der Online-Bibliothek enthielt keinen verwertbaren Text.");

  if (workbook.items.length < 3 || workbook.items.length > 15) {
    opts.onStep?.("Strukturiere das Wochenprogramm …");
    workbook = await extractWorkbookWithAi(text, range);
  }
  const header = splitWorkbookWeeks(text, year, isoWeek);

  // Versammlungsbibelstudium: verlinkten Stoff dazuladen
  const cbs = workbook.items.find((i) => i.section === "versammlungsbibelstudium" || /Versammlungsbibelstudium/i.test(i.title));
  let material: StudyMaterial | null = null;
  const cbsUrl = cbs ? (findCongregationStudyUrl(wbPage.text, wbPage.url) ?? findCongregationStudyUrl(page.text, page.url)) : null;
  if (cbs && cbsUrl) {
    opts.onStep?.("Lade das Versammlungsbibelstudium …");
    try {
      material = await loadStudyMaterial(cbsUrl, `${cbs.title}\n${cbs.originalText}`);
      if (!material) notes.push("Im Stoff für das Versammlungsbibelstudium wurden keine Absätze erkannt.");
    } catch (err) {
      notes.push(`Versammlungsbibelstudium: ${friendlyError(err)}`);
    }
  } else if (cbs) {
    notes.push("Kein Link zum Stoff des Versammlungsbibelstudiums gefunden.");
  }

  let workbookItems = 0;
  const pageLinks = [...extractRefLinks(wbPage.text, wbPage.url), ...(wbPage === page ? [] : extractRefLinks(page.text, page.url))];
  if (workbook.items.length) {
    await saveImport({
      weekId: week.id,
      kind: "workbook",
      origin: "wol",
      contentHash: await contentHash(text),
      sourceUrl: wbPage.url,
      overwrite: true,
      data: {
        title: `Woche ${formatRange(range.start, range.end)}`,
        bibleReading: header.bibleReading ?? workbook.bibleReading,
        items: workbook.items.map((it) => ({
          ...it,
          duration: it.duration ?? null,
          material: it === cbs ? material : null,
          links: itemLinks(it, pageLinks, header.bibleReading ?? workbook.bibleReading),
        })),
      },
    });
    workbookItems = workbook.items.length;
  } else {
    notes.push("Das Arbeitsheft-Programm wurde auf der Seite nicht gefunden.");
  }

  // 2) Wachtturm-Studienartikel (auf der Seite verlinkt)
  let paragraphs = 0;
  let articleTitle: string | null = null;
  const articleUrl = findStudyArticleUrl(page.text, page.url);
  if (articleUrl) {
    opts.onStep?.("Lade den Wachtturm-Studienartikel …");
    try {
      const art = await fetchJwPage(articleUrl);
      const artText = normalizeImportText(cleanFetchedText(art.text));
      let article = parseWatchtowerText(artText);
      if (article.paragraphs.filter((p) => p.question).length < 3) {
        opts.onStep?.("Strukturiere den Studienartikel …");
        article = await extractArticleWithAi(artText, range);
      }
      if (article.paragraphs.length) {
        await saveImport({
          weekId: week.id,
          kind: "watchtower",
          origin: "wol",
          contentHash: await contentHash(artText),
          sourceUrl: art.url,
          overwrite: true,
          data: {
            ...article,
            title: article.title || art.title || "Wachtturm-Studienartikel",
            issue: null,
            publishedAt: null,
          },
        });
        paragraphs = article.paragraphs.length;
        articleTitle = article.title || art.title;
      } else {
        notes.push("Im Studienartikel wurden keine Absätze erkannt.");
      }
    } catch (err) {
      notes.push(`Wachtturm-Studienartikel: ${friendlyError(err)}`);
    }
  } else {
    notes.push("Auf der Seite wurde kein Link zum Wachtturm-Studienartikel gefunden.");
  }
  notifyChange();
  return { workbookItems, paragraphs, articleTitle, notes };
}

const officialLinks = (links: RefLink[] | undefined) => (links ?? []).filter((l) => checkOfficialUrl(l.url).ok);

/** Verweise eines Programmpunkts; bei „Was hast du beim Bibellesen entdeckt?“ auch das Bibelleseprogramm. */
function itemLinks(it: { title: string; originalText: string; questions: string[] }, links: RefLink[], bibleReading: string | null): RefLink[] {
  const own = linksIn(`${it.title}\n${it.originalText}`, links);
  const reading =
    bibleReading && it.questions.some((q) => /Bibellesen/i.test(q)) ? links.filter((l) => l.label.toLowerCase() === bibleReading.toLowerCase().trim()) : [];
  return [...new Map([...reading, ...own].map((l) => [l.url, l])).values()].slice(0, 20);
}

/** Lädt verlinkten Stoff (Originaltext) und nimmt nur den angegebenen Absatzbereich („Abs. 1-7“). */
async function loadStudyMaterial(url: string, itemText: string): Promise<StudyMaterial | null> {
  const page = await fetchJwPage(url);
  const material = await materialFromPage(page, itemText);
  if (!material) return null;
  // Verweise in den Fragen (z. B. „it ‚Jephtha‘ Abs. 6“) für das Ausfüllen merken
  const questions = material.paragraphs.map((p) => p.question).join("\n");
  return {
    ...material,
    links: linksIn(normalizeImportText(questions), extractRefLinks(page.text, page.url)).slice(0, 40),
  };
}

async function materialFromPage(page: FetchedPage, itemText: string): Promise<StudyMaterial | null> {
  const text = normalizeImportText(cleanFetchedText(page.text));
  const pageTitle = page.title?.split(/\s+[—–-]\s+Wachtturm ONLINE-BIBLIOTHEK/i)[0].trim() || null;

  // 1) Nummerierte Absätze mit Fragen (Studienartikel, Bücher mit Absatzfragen)
  const numbered = parseWatchtowerText(text);
  const withQuestion = numbered.paragraphs.filter((p) => p.question).length;
  if (withQuestion >= 2 && withQuestion * 2 >= numbered.paragraphs.length) {
    let paragraphs = numbered.paragraphs;
    const r = paragraphRange(itemText);
    if (r) {
      const inRange = paragraphs.filter((p) => {
        const n = parseInt(p.number, 10);
        return Number.isFinite(n) && n >= r[0] && n <= r[1];
      });
      if (inRange.length) paragraphs = inRange;
    }
    return {
      title: numbered.title || pageTitle || "Studienmaterial",
      url: page.url,
      paragraphs: paragraphs.slice(0, 80).map((p) => ({
        number: p.number,
        question: p.question ?? "",
        text: p.originalText,
      })),
    };
  }

  // 2) Kapitel ohne Absatznummern (Erzählung, danach Fragen zum Besprechen)
  const chapter = parseChapterMaterial(text);
  if (chapter.paragraphs.some((p) => p.question) && chapter.paragraphs.some((p) => p.text)) {
    return {
      title: pageTitle || chapter.title || "Studienmaterial",
      url: page.url,
      paragraphs: chapter.paragraphs.slice(0, 120),
    };
  }

  // 3) Notfalls von der KI strukturieren lassen (wörtlich geprüft)
  const ai = await extractMaterialWithAi(text);
  if (ai.paragraphs.some((p) => p.text)) {
    return {
      title: pageTitle || ai.title || "Studienmaterial",
      url: page.url,
      paragraphs: ai.paragraphs.slice(0, 120),
    };
  }
  // 4) Wenigstens den Text übernehmen
  if (chapter.paragraphs.some((p) => p.text)) {
    return {
      title: pageTitle || chapter.title || "Studienmaterial",
      url: page.url,
      paragraphs: chapter.paragraphs.slice(0, 120),
    };
  }
  const found = chapter.paragraphs.filter((p) => p.question).length;
  throw new UserError(`Im Stoff wurden keine Absätze erkannt (${text.length} Zeichen Text, ${found} Fragen gefunden, Seite: ${pageTitle ?? page.url}).`);
}

/* ── Textmarker ──────────────────────────────────────────────────── */

export async function addHighlight(h: Omit<Highlight, "id" | "createdAt">) {
  if (h.end <= h.start || h.text.length > 5000) throw new UserError("Ungültige Markierung.");
  await store.saveHighlight(h);
  notifyChange();
}

export async function removeHighlight(id: string) {
  await store.deleteHighlights([id]);
  notifyChange();
}

export async function recolorHighlight(id: string, color: Highlight["color"]) {
  await store.setHighlightColor(id, color);
  notifyChange();
}

/* ── Antwortfelder (graue Felder unter den Fragen) ───────────────── */

export async function saveFieldText(t: Target, index: number, text: string) {
  if (text.length > 5000) throw new UserError("Die Antwort ist zu lang.");
  await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  return store.saveField({ ...t, index, text, origin: "user" });
}

/** Füllt die Felder eines Abschnitts. Selbst geschriebene Antworten werden nie überschrieben. */
export async function fillFields(t: Target, opts: { replaceAi?: boolean } = {}): Promise<number> {
  const settings = await withAi();
  const target = await resolveTarget(store, t.weekId, t.targetType, t.targetId);
  const existing = (await store.listFields(t.weekId)).filter((f) => f.targetType === t.targetType && f.targetId === t.targetId);
  const keep = (i: number) => existing.some((f) => f.index === i && (f.origin === "user" || !opts.replaceAi));
  let filled = 0;

  if (target.type === "paragraph") {
    if (!target.paragraph.question || keep(0)) return 0;
    const answer = (await store.getAnswer("paragraph", target.paragraph.id)) ?? (await generateAnswerSet(store, target, settings));
    await store.saveField({ ...t, index: 0, text: answer.short, origin: "ai" });
    return 1;
  }

  // Eigene Fragen des Programmpunkts und Fragen des Studienmaterials – gleiche Zählung wie die Felder
  const open = itemQuestions(target.item)
    .map((_, i) => i)
    .filter((i) => !keep(i));
  if (open.length === 0) return 0;
  const refs = await referenceTexts(target.item);
  let answers: string[];
  try {
    ({ answers } = await generateFieldAnswers(target, settings, refs));
  } catch (err) {
    // Ungültige Anfrage (400, z. B. zu viel Text): einmal mit weniger Verweisen versuchen
    if (!(err instanceof Anthropic.BadRequestError) || refs.length === 0) throw err;
    ({ answers } = await generateFieldAnswers(target, settings, shrinkRefs(refs)));
  }
  for (const i of open) {
    if (!answers[i]) continue;
    await store.saveField({ ...t, index: i, text: answers[i], origin: "ai" });
    filled++;
  }
  return filled;
}

/** Weniger und kürzere Verweise für einen zweiten Versuch */
function shrinkRefs(refs: ReferenceText[]): ReferenceText[] {
  return refs.slice(0, 4).map((r) => ({ ...r, text: r.text.slice(0, 3000) }));
}

/** Bereits abgerufene Verweise (für die Dauer der Sitzung, nur im Arbeitsspeicher) */
const refCache = new Map<string, Promise<string | null>>();
const MAX_REFS = 8;
const MAX_REF_CHARS = 8000;

/**
 * Ruft die verlinkten Verweise eines Programmpunkts von jw.org ab (Veröffentlichungen zuerst,
 * dann Bibeltexte). Fehlgeschlagene Abrufe werden übersprungen.
 */
async function referenceTexts(item: WorkbookItem): Promise<ReferenceText[]> {
  const all = [...(item.material?.links ?? []), ...(item.links ?? [])].filter((l) => checkOfficialUrl(l.url).ok);
  const unique = [...new Map(all.map((l) => [l.url, l])).values()];
  const pick = [...unique.filter((l) => !/\/wol\/bc?\//.test(l.url)), ...unique.filter((l) => /\/wol\/bc?\//.test(l.url))].slice(0, MAX_REFS);
  const texts = await Promise.all(
    pick.map(async (l) => {
      if (!refCache.has(l.url)) {
        refCache.set(
          l.url,
          fetchJwPage(l.url)
            .then((p) => normalizeImportText(cleanFetchedText(p.text)).slice(0, MAX_REF_CHARS))
            .catch(() => null),
        );
      }
      const text = await refCache.get(l.url)!;
      return text ? { label: l.label, url: l.url, text } : null;
    }),
  );
  return texts.filter((x): x is ReferenceText => x !== null);
}

/** „Alle Felder ausfüllen“ für die ganze Woche (läuft auf dem Gerät, App geöffnet lassen). */
export async function fillWeekFields(weekId: string, onProgress?: (done: number, total: number) => void) {
  await withAi();
  if (!aiEnabled()) throw new UserError("Für das Ausfüllen wird der Anthropic-API-Schlüssel benötigt (Einstellungen).");
  const [article, workbook] = await Promise.all([store.getArticle(weekId), store.getWorkbook(weekId)]);
  const targets: Target[] = [
    ...(workbook?.items ?? [])
      .filter((i) => itemQuestions(i).length)
      .map((i) => ({
        weekId,
        targetType: "workbook_item" as const,
        targetId: i.id,
      })),
    ...(article?.paragraphs ?? [])
      .filter((p) => p.question)
      .map((p) => ({
        weekId,
        targetType: "paragraph" as const,
        targetId: p.id,
      })),
  ];
  let done = 0;
  const errors: string[] = [];
  const queue = [...targets];
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      try {
        await fillFields(t);
      } catch (err) {
        errors.push(friendlyError(err));
      }
      done++;
      onProgress?.(done, targets.length);
      notifyChange();
    }
  };
  await Promise.all([worker(), worker()]);
  notifyChange();
  return { total: targets.length, errors: [...new Set(errors)] };
}
