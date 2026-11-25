import { DEFAULT_SETTINGS } from "@/lib/types";
import type { AnswerField, AnswerSet, Article, Favorite, Lookup, Note, ProgressEntry, Settings, Source, StoredImage, Week, Workbook } from "@/lib/types";
import { weekRange } from "@/lib/week";
import type { NewArticle, NewSource, NewWorkbook, Store } from "./store";

/**
 * Speicher direkt auf dem Gerät (IndexedDB des Browsers).
 * Es gibt keinen Server und keine Cloud – alle Daten bleiben auf dem iPhone.
 */

export interface Db {
  version: 1;
  settings: Settings;
  weeks: Week[];
  sources: Source[];
  workbooks: Workbook[];
  articles: Article[];
  answers: AnswerSet[];
  notes: Note[];
  favorites: Favorite[];
  progress: ProgressEntry[];
  lookups: Lookup[];
  fields: AnswerField[];
}

const emptyDb = (): Db => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  weeks: [],
  sources: [],
  workbooks: [],
  articles: [],
  answers: [],
  notes: [],
  favorites: [],
  progress: [],
  lookups: [],
  fields: [],
});

const DB_NAME = "jw-plus-study";
const STORE = "kv";
const KEY = "db";
const IMAGES = "images"; // Bilder getrennt, damit der Datenbestand klein bleibt

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Speicher nicht verfügbar."));
  });
}

let idb: Promise<IDBDatabase> | null = null;
let cache: Db | null = null;
let queue: Promise<unknown> = Promise.resolve();

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, storeName = STORE): Promise<T> {
  idb ??= openIdb();
  return idb.then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error ?? new Error("Speicherfehler."));
        t.onabort = () => reject(t.error ?? new Error("Speichern abgebrochen (Speicher voll?)."));
      }),
  );
}

function normalize(raw: Partial<Db> | undefined): Db {
  const db = { ...emptyDb(), ...(raw ?? {}) } as Db;
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings };
  return db;
}

async function load(): Promise<Db> {
  if (cache) return cache;
  cache = normalize(await tx<Db | undefined>("readonly", (s) => s.get(KEY) as IDBRequest<Db | undefined>));
  return cache;
}

async function persist(db: Db) {
  await tx("readwrite", (s) => s.put(db, KEY));
  cache = db;
}

function read<T>(fn: (db: Db) => T): Promise<T> {
  const run = queue.then(async () => structuredClone(fn(await load())));
  queue = run.catch(() => undefined);
  return run;
}

function write<T>(fn: (db: Db) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = structuredClone(await load());
    const result = fn(db);
    await persist(db);
    return structuredClone(result);
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Sicherung als JSON. Der API-Schlüssel wird nur auf ausdrücklichen Wunsch mitgesichert. */
export function exportData(includeApiKey = false): Promise<Db> {
  return read((db) => (includeApiKey ? db : { ...db, settings: { ...db.settings, anthropicKey: "" } }));
}

/** Stellt eine Sicherung wieder her (ersetzt alle Daten). Ein vorhandener API-Schlüssel bleibt erhalten, wenn die Sicherung keinen enthält. */
export function importData(data: unknown): Promise<void> {
  if (!data || typeof data !== "object" || (data as Db).version !== 1 || !Array.isArray((data as Db).weeks)) {
    return Promise.reject(new Error("Die Datei ist keine gültige Sicherung von JW+ Study."));
  }
  return write((db) => {
    const incoming = normalize(data as Db);
    if (!incoming.settings.anthropicKey) incoming.settings.anthropicKey = db.settings.anthropicKey;
    Object.assign(db, incoming);
  });
}

export async function storageInfo(): Promise<{ persisted: boolean; usage: number | null; quota: number | null }> {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const est = await navigator.storage?.estimate?.().catch(() => null);
  return { persisted, usage: est?.usage ?? null, quota: est?.quota ?? null };
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

const now = () => new Date().toISOString();

export class BrowserStore implements Store {

  getSettings() {
    return read((db) => db.settings);
  }
  saveSettings(patch: Partial<Settings>) {
    return write((db) => (db.settings = { ...db.settings, ...patch }));
  }

  listWeeks() {
    return read((db) =>
      [...db.weeks].sort((a, b) => b.year - a.year || b.week - a.week),
    );
  }
  getWeek(year: number, week: number) {
    return read((db) => db.weeks.find((w) => w.year === year && w.week === week) ?? null);
  }
  getWeekById(id: string) {
    return read((db) => db.weeks.find((w) => w.id === id) ?? null);
  }
  ensureWeek(year: number, week: number) {
    const range = weekRange(year, week);
    return write((db) => {
      const found = db.weeks.find((w) => w.year === year && w.week === week);
      if (found) return found;
      const created: Week = {
        id: crypto.randomUUID(),
        year,
        week,
        start: range.start,
        end: range.end,
        status: "leer",
        prepJob: null,
        lastCheckedAt: null,
        createdAt: now(),
      };
      db.weeks.push(created);
      return created;
    });
  }
  async updateWeek(id: string, patch: Partial<Pick<Week, "status" | "prepJob" | "lastCheckedAt">>) {
    await write((db) => {
      const w = db.weeks.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
    });
  }

  listSources(weekId?: string) {
    return read((db) =>
      db.sources
        .filter((s) => (weekId ? s.weekId === weekId : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  addSource(input: NewSource) {
    return write((db) => {
      const dup = db.sources.find(
        (s) =>
          s.weekId === input.weekId &&
          ((input.url && s.url === input.url) || (input.contentHash && s.contentHash === input.contentHash)),
      );
      if (dup) return { source: dup, duplicate: true };
      const source: Source = { ...input, id: crypto.randomUUID(), createdAt: now() };
      db.sources.push(source);
      return { source, duplicate: false };
    });
  }
  async updateSource(id: string, patch: Partial<Source>) {
    await write((db) => {
      const s = db.sources.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
    });
  }
  async deleteSource(id: string) {
    await write((db) => {
      db.sources = db.sources.filter((s) => s.id !== id);
    });
  }

  getWorkbook(weekId: string) {
    return read((db) => db.workbooks.find((w) => w.weekId === weekId) ?? null);
  }
  saveWorkbook(input: NewWorkbook) {
    return write((db) => {
      const existing = db.workbooks.find((w) => w.weekId === input.weekId);
      const id = existing?.id ?? crypto.randomUUID();
      const wb: Workbook = {
        ...input,
        id,
        createdAt: existing?.createdAt ?? now(),
        items: input.items.map((it) => ({ ...it, id: crypto.randomUUID(), workbookId: id })),
      };
      if (existing) {
        const oldIds = new Set(existing.items.map((i) => i.id));
        db.answers = db.answers.filter((a) => !(a.targetType === "workbook_item" && oldIds.has(a.targetId)));
        db.progress = db.progress.filter((p) => !(p.targetType === "workbook_item" && oldIds.has(p.targetId)));
      }
      db.workbooks = db.workbooks.filter((w) => w.weekId !== input.weekId);
      db.workbooks.push(wb);
      return wb;
    });
  }
  async deleteWorkbook(weekId: string) {
    await write((db) => {
      const wb = db.workbooks.find((w) => w.weekId === weekId);
      if (!wb) return;
      const ids = new Set(wb.items.map((i) => i.id));
      db.answers = db.answers.filter((a) => !ids.has(a.targetId));
      db.progress = db.progress.filter((p) => !ids.has(p.targetId));
      db.workbooks = db.workbooks.filter((w) => w.weekId !== weekId);
    });
  }

  getArticle(weekId: string) {
    return read((db) => db.articles.find((a) => a.weekId === weekId) ?? null);
  }
  saveArticle(input: NewArticle) {
    return write((db) => {
      const existing = db.articles.find((a) => a.weekId === input.weekId);
      const id = existing?.id ?? crypto.randomUUID();
      const article: Article = {
        ...input,
        id,
        createdAt: existing?.createdAt ?? now(),
        paragraphs: input.paragraphs.map((p) => ({ ...p, id: crypto.randomUUID(), articleId: id })),
      };
      if (existing) {
        const oldIds = new Set(existing.paragraphs.map((p) => p.id));
        db.answers = db.answers.filter((a) => !(a.targetType === "paragraph" && oldIds.has(a.targetId)));
        db.progress = db.progress.filter((p) => !(p.targetType === "paragraph" && oldIds.has(p.targetId)));
      }
      db.articles = db.articles.filter((a) => a.weekId !== input.weekId);
      db.articles.push(article);
      return article;
    });
  }
  async deleteArticle(weekId: string) {
    await write((db) => {
      const art = db.articles.find((a) => a.weekId === weekId);
      if (!art) return;
      const ids = new Set(art.paragraphs.map((p) => p.id));
      db.answers = db.answers.filter((a) => !ids.has(a.targetId));
      db.progress = db.progress.filter((p) => !ids.has(p.targetId));
      db.articles = db.articles.filter((a) => a.weekId !== weekId);
    });
  }

  getAnswer(targetType: AnswerSet["targetType"], targetId: string) {
    return read((db) => db.answers.find((a) => a.targetType === targetType && a.targetId === targetId) ?? null);
  }
  listAnswers(weekId: string) {
    return read((db) => db.answers.filter((a) => a.weekId === weekId));
  }
  saveAnswer(answer: Omit<AnswerSet, "id"> & { id?: string }) {
    return write((db) => {
      const idx = db.answers.findIndex(
        (a) => a.targetType === answer.targetType && a.targetId === answer.targetId,
      );
      const saved: AnswerSet = { ...answer, id: answer.id ?? db.answers[idx]?.id ?? crypto.randomUUID() };
      if (idx >= 0) db.answers[idx] = saved;
      else db.answers.push(saved);
      return saved;
    });
  }

  getNote(targetType: Note["targetType"], targetId: string) {
    return read((db) => db.notes.find((n) => n.targetType === targetType && n.targetId === targetId) ?? null);
  }
  listNotes(weekId: string) {
    return read((db) => db.notes.filter((n) => n.weekId === weekId));
  }
  saveNote(note: Omit<Note, "updatedAt">) {
    return write((db) => {
      const saved: Note = { ...note, updatedAt: now() };
      db.notes = db.notes.filter((n) => !(n.targetType === note.targetType && n.targetId === note.targetId));
      if (note.text.trim()) db.notes.push(saved);
      return saved;
    });
  }

  listFavorites() {
    return read((db) => [...db.favorites].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  addFavorite(fav: Omit<Favorite, "id" | "createdAt">) {
    return write((db) => {
      const dup = db.favorites.find((f) => f.targetId === fav.targetId && f.variant === fav.variant && f.text === fav.text);
      if (dup) return dup;
      const saved: Favorite = { ...fav, id: crypto.randomUUID(), createdAt: now() };
      db.favorites.push(saved);
      return saved;
    });
  }
  async removeFavorite(id: string) {
    await write((db) => {
      db.favorites = db.favorites.filter((f) => f.id !== id);
    });
  }

  listProgress(weekId: string) {
    return read((db) => db.progress.filter((p) => p.weekId === weekId));
  }
  async setProgress(entry: Omit<ProgressEntry, "updatedAt">) {
    await write((db) => {
      db.progress = db.progress.filter(
        (p) => !(p.targetType === entry.targetType && p.targetId === entry.targetId),
      );
      db.progress.push({ ...entry, updatedAt: now() });
    });
  }

  listFields(weekId: string) {
    return read((db) => db.fields.filter((f) => f.weekId === weekId));
  }
  saveField(field: Omit<AnswerField, "updatedAt">) {
    return write((db) => {
      const saved: AnswerField = { ...field, updatedAt: now() };
      db.fields = db.fields.filter((f) => !(f.targetType === field.targetType && f.targetId === field.targetId && f.index === field.index));
      if (field.text.trim()) db.fields.push(saved);
      return saved;
    });
  }

  listLookups(weekId: string) {
    return read((db) => db.lookups.filter((l) => l.weekId === weekId));
  }
  saveLookup(lookup: Omit<Lookup, "id" | "createdAt">) {
    return write((db) => {
      const saved: Lookup = { ...lookup, id: crypto.randomUUID(), createdAt: now() };
      db.lookups.push(saved);
      return saved;
    });
  }
  async deleteLookup(id: string) {
    await write((db) => {
      db.lookups = db.lookups.filter((l) => l.id !== id);
    });
  }

  async listImages(weekId: string, kind?: StoredImage["kind"]) {
    const all = await tx<StoredImage[]>("readonly", (s) => s.getAll() as IDBRequest<StoredImage[]>, IMAGES);
    return all.filter((i) => i.weekId === weekId && (!kind || i.kind === kind)).sort((a, b) => a.page - b.page);
  }
  async replaceImages(weekId: string, kind: StoredImage["kind"], images: Array<Omit<StoredImage, "id" | "weekId" | "kind" | "createdAt">>) {
    const old = await this.listImages(weekId, kind);
    idb ??= openIdb();
    const db = await idb;
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(IMAGES, "readwrite");
      const s = t.objectStore(IMAGES);
      for (const o of old) s.delete(o.id);
      const createdAt = now();
      for (const img of images) s.put({ ...img, id: crypto.randomUUID(), weekId, kind, createdAt } satisfies StoredImage);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error ?? new Error("Bilder konnten nicht gespeichert werden."));
      t.onabort = () => reject(t.error ?? new Error("Speichern der Bilder abgebrochen (Speicher voll?)."));
    });
  }
}
