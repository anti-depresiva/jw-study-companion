import { generateAnswerSet } from "@/lib/ai/answers";
import { identifyWeekSources } from "@/lib/ai/identify";
import { aiEnabled } from "@/lib/ai/client";
import type { Store } from "@/lib/data/store";
import { wolMeetingsUrl } from "@/lib/sources/links";
import type { PrepJob, Week } from "@/lib/types";
import { weekRange } from "@/lib/week";
import { resolveTarget } from "./targets";

// Prozessweit (über Bundles hinweg) – verhindert doppelte Vorbereitungsläufe.
const g = globalThis as unknown as { __jwpsRunning?: Set<string> };
const running = (g.__jwpsRunning ??= new Set<string>());

const job = (state: PrepJob["state"], done: number, total: number, message: string): PrepJob => ({
  state,
  done,
  total,
  message,
  updatedAt: new Date().toISOString(),
});

export interface CheckResult {
  week: Week;
  added: number;
  notes: string[];
}

/** Wochenprüfung: Woche anlegen, offizielle Quellen erkennen (ohne Inhalte abzurufen). */
export async function checkWeek(store: Store, year: number, isoWeek: number, opts: { search: boolean }): Promise<CheckResult> {
  const week = await store.ensureWeek(year, isoWeek);
  const range = weekRange(year, isoWeek);
  const notes: string[] = [];
  let added = 0;

  const meetings = await store.addSource({
    weekId: week.id,
    title: `Zusammenkünfte KW ${isoWeek}/${year} – Online-Bibliothek`,
    kind: "other",
    url: wolMeetingsUrl(year, isoWeek),
    publishedAt: null,
    verification: "unverified_pattern",
    origin: "pattern",
    contentHash: null,
    note: "Aus dem bekannten Linkmuster der Online-Bibliothek erzeugt – noch nicht geprüft.",
  });
  if (!meetings.duplicate) added++;

  if (opts.search && aiEnabled()) {
    try {
      const { found, notes: n } = await identifyWeekSources(range);
      notes.push(...n);
      for (const f of found) {
        const res = await store.addSource({
          weekId: week.id,
          title: f.title,
          kind: f.kind,
          url: f.url,
          publishedAt: f.issue,
          verification: "verified_search",
          origin: "search",
          contentHash: null,
          note: "Über die auf jw.org beschränkte Suche gefunden; URL stammt aus den Suchergebnissen.",
        });
        if (!res.duplicate) added++;
      }
    } catch (err) {
      notes.push(`Quellensuche nicht möglich: ${(err as Error).message}`);
    }
  } else if (opts.search) {
    notes.push("Quellensuche übersprungen (kein ANTHROPIC_API_KEY).");
  }

  const article = await store.getArticle(week.id);
  const workbook = await store.getWorkbook(week.id);
  const status = article || workbook ? (week.status === "vorbereitet" ? "vorbereitet" : "importiert") : "quellen_erkannt";
  await store.updateWeek(week.id, { status, lastCheckedAt: new Date().toISOString() });
  return { week: (await store.getWeekById(week.id))!, added, notes };
}

export function isPreparing(weekId: string) {
  return running.has(weekId);
}

/**
 * Erzeugt fehlende KI-Antworten für alle importierten Absätze und
 * Programmpunkte der Woche. Läuft im Hintergrund; Fortschritt in week.prepJob.
 */
export async function prepareWeekAnswers(store: Store, weekId: string, opts: { force?: boolean; onProgress?: () => void } = {}) {
  if (running.has(weekId)) return;
  running.add(weekId);
  try {
    const settings = await store.getSettings();
    const article = await store.getArticle(weekId);
    const workbook = await store.getWorkbook(weekId);
    const existing = new Set((await store.listAnswers(weekId)).map((a) => `${a.targetType}:${a.targetId}`));

    const targets: Array<{ type: "paragraph" | "workbook_item"; id: string }> = [
      ...(article?.paragraphs ?? []).map((p) => ({ type: "paragraph" as const, id: p.id })),
      ...(workbook?.items ?? [])
        .filter((i) => i.originalText.trim())
        .map((i) => ({ type: "workbook_item" as const, id: i.id })),
    ].filter((t) => opts.force || !existing.has(`${t.type}:${t.id}`));

    if (targets.length === 0) {
      await store.updateWeek(weekId, {
        status: article || workbook ? "vorbereitet" : "quellen_erkannt",
        prepJob: job("done", 0, 0, article || workbook ? "Alle Antworten sind bereits vorbereitet." : "Noch keine Inhalte importiert."),
      });
      return;
    }

    let done = 0;
    const errors: string[] = [];
    await store.updateWeek(weekId, { prepJob: job("running", 0, targets.length, "KI-Antworten werden erstellt – App bitte geöffnet lassen …") });
    opts.onProgress?.();

    // Begrenzte Parallelität schont Rate-Limits; Artikelkontext wird gecacht.
    const queue = [...targets];
    const worker = async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        try {
          const resolved = await resolveTarget(store, weekId, t.type, t.id);
          await generateAnswerSet(store, resolved, settings);
        } catch (err) {
          errors.push((err as Error).message);
        }
        done++;
        await store.updateWeek(weekId, {
          prepJob: job("running", done, targets.length, `${done} von ${targets.length} Abschnitten vorbereitet …`),
        });
        opts.onProgress?.();
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    await store.updateWeek(weekId, {
      status: errors.length === targets.length ? "importiert" : "vorbereitet",
      prepJob: errors.length
        ? job("error", done - errors.length, targets.length, `${errors.length} Abschnitt(e) fehlgeschlagen: ${[...new Set(errors)].slice(0, 2).join(" · ")}`)
        : job("done", done, targets.length, "Die Woche ist vorbereitet."),
    });
  } catch (err) {
    await store.updateWeek(weekId, { prepJob: job("error", 0, 0, (err as Error).message) });
  } finally {
    running.delete(weekId);
  }
}
