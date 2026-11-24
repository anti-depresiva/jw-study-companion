import type {
  AnswerSet,
  Article,
  Favorite,
  Note,
  Lookup,
  ProgressEntry,
  StoredImage,
  Settings,
  Source,
  TargetType,
  Week,
  Workbook,
} from "@/lib/types";

export type NewArticle = Omit<Article, "id" | "createdAt" | "paragraphs"> & {
  paragraphs: Array<Omit<Article["paragraphs"][number], "id" | "articleId">>;
};
export type NewWorkbook = Omit<Workbook, "id" | "createdAt" | "items"> & {
  items: Array<Omit<Workbook["items"][number], "id" | "workbookId">>;
};
export type NewSource = Omit<Source, "id" | "createdAt">;

/**
 * Persistenz-Schnittstelle:
 *  - BrowserStore (IndexedDB auf dem Gerät)
 * Alle Daten bleiben auf dem Gerät.
 */
export interface Store {

  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;

  listWeeks(): Promise<Week[]>;
  getWeek(year: number, week: number): Promise<Week | null>;
  getWeekById(id: string): Promise<Week | null>;
  ensureWeek(year: number, week: number): Promise<Week>;
  updateWeek(id: string, patch: Partial<Pick<Week, "status" | "prepJob" | "lastCheckedAt">>): Promise<void>;

  listSources(weekId?: string): Promise<Source[]>;
  /** Fügt eine Quelle hinzu; identische URL bzw. identischer Inhalts-Hash pro Woche wird nicht doppelt gespeichert. */
  addSource(source: NewSource): Promise<{ source: Source; duplicate: boolean }>;
  updateSource(id: string, patch: Partial<Pick<Source, "verification" | "url" | "title" | "note" | "publishedAt">>): Promise<void>;
  deleteSource(id: string): Promise<void>;

  getWorkbook(weekId: string): Promise<Workbook | null>;
  saveWorkbook(input: NewWorkbook): Promise<Workbook>;
  deleteWorkbook(weekId: string): Promise<void>;

  getArticle(weekId: string): Promise<Article | null>;
  saveArticle(input: NewArticle): Promise<Article>;
  deleteArticle(weekId: string): Promise<void>;

  getAnswer(targetType: TargetType, targetId: string): Promise<AnswerSet | null>;
  listAnswers(weekId: string): Promise<AnswerSet[]>;
  saveAnswer(answer: Omit<AnswerSet, "id"> & { id?: string }): Promise<AnswerSet>;

  getNote(targetType: TargetType, targetId: string): Promise<Note | null>;
  listNotes(weekId: string): Promise<Note[]>;
  saveNote(note: Omit<Note, "updatedAt">): Promise<Note>;

  listFavorites(): Promise<Favorite[]>;
  addFavorite(fav: Omit<Favorite, "id" | "createdAt">): Promise<Favorite>;
  removeFavorite(id: string): Promise<void>;

  listProgress(weekId: string): Promise<ProgressEntry[]>;
  setProgress(entry: Omit<ProgressEntry, "updatedAt">): Promise<void>;

  listLookups(weekId: string): Promise<Lookup[]>;
  saveLookup(lookup: Omit<Lookup, "id" | "createdAt">): Promise<Lookup>;
  deleteLookup(id: string): Promise<void>;

  listImages(weekId: string, kind?: StoredImage["kind"]): Promise<StoredImage[]>;
  replaceImages(weekId: string, kind: StoredImage["kind"], images: Array<Omit<StoredImage, "id" | "weekId" | "kind" | "createdAt">>): Promise<void>;
}
