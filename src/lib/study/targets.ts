import { itemHref, paragraphHref } from "@/lib/routes";
import type { Store } from "@/lib/data/store";
import { checkOfficialUrl } from "@/lib/sources/domain";
import type { Article, Paragraph, Source, SourceRef, TargetType, Week, Workbook, WorkbookItem } from "@/lib/types";
import { SECTION_TITLES } from "@/lib/types";

export const NO_SOURCE_MESSAGE = "Dazu konnte keine passende offizielle Quelle auf jw.org gefunden werden.";

export class NoSourceError extends Error {
  constructor(detail?: string) {
    super(detail ? `${NO_SOURCE_MESSAGE} ${detail}` : NO_SOURCE_MESSAGE);
  }
}
export class NotFoundError extends Error {}

export type ResolvedTarget =
  | {
      type: "paragraph";
      week: Week;
      article: Article;
      paragraph: Paragraph;
      source: Source | null;
      label: string;
      question: string;
      originalText: string;
      href: string;
    }
  | {
      type: "workbook_item";
      week: Week;
      workbook: Workbook;
      item: WorkbookItem;
      source: Source | null;
      label: string;
      question: string;
      originalText: string;
      href: string;
    };

/** Sucht ein Studienelement in einer bestimmten Woche (IDs werden nie blind übernommen). */
export async function resolveTarget(
  store: Store,
  weekId: string,
  type: TargetType,
  targetId: string,
): Promise<ResolvedTarget> {
  const week = await store.getWeekById(weekId);
  if (!week) throw new NotFoundError("Woche nicht gefunden.");
  const sources = await store.listSources(week.id);

  if (type === "paragraph") {
    const article = await store.getArticle(week.id);
    const idx = article?.paragraphs.findIndex((p) => p.id === targetId) ?? -1;
    if (!article || idx < 0) throw new NotFoundError("Absatz nicht gefunden.");
    const paragraph = article.paragraphs[idx];
    return {
      type,
      week,
      article,
      paragraph,
      source: sources.find((s) => s.id === article.sourceId) ?? null,
      label: `Absatz ${paragraph.number}`,
      question: paragraph.question,
      originalText: paragraph.originalText,
      href: paragraphHref(week.year, week.week, idx + 1),
    };
  }
  const workbook = await store.getWorkbook(week.id);
  const item = workbook?.items.find((i) => i.id === targetId);
  if (!workbook || !item) throw new NotFoundError("Programmpunkt nicht gefunden.");
  return {
    type,
    week,
    workbook,
    item,
    source: sources.find((s) => s.id === workbook.sourceId) ?? null,
    label: `Programmpunkt ${item.position}: ${item.title}`,
    question: item.questions.join(" "),
    originalText: item.originalText,
    href: itemHref(week.year, week.week, item.id),
  };
}

/**
 * Quellenprüfung vor jeder KI-Antwort (16.4): Es muss ein Originaltext
 * vorhanden sein UND eine Quelle, die entweder eine geprüfte/bestätigte
 * jw.org-Adresse hat oder als Benutzerimport gekennzeichnet ist.
 */
export function assertSourceReady(t: ResolvedTarget) {
  if (!t.originalText.trim()) throw new NoSourceError("Für diesen Abschnitt liegt kein Originaltext vor.");
  const src = t.source;
  if (!src || src.verification === "rejected") {
    throw new NoSourceError("Bitte die Originalquelle importieren oder verknüpfen.");
  }
  if (src.url && !checkOfficialUrl(src.url).ok) throw new NoSourceError("Die verknüpfte Quelle liegt nicht auf jw.org.");
}

export function buildSourceRef(t: ResolvedTarget, scriptures: string[]): SourceRef {
  const src = t.source;
  const url = src?.url && checkOfficialUrl(src.url).ok ? src.url : null;
  if (t.type === "paragraph") {
    return {
      publication: `Der Wachtturm (Studienausgabe)${t.article.issue ? `, ${t.article.issue}` : ""}`,
      title: t.article.title,
      section: `Absatz ${t.paragraph.number}`,
      date: t.article.publishedAt ?? src?.publishedAt ?? null,
      url: url ?? t.article.sourceUrl ?? null,
      verification: src?.verification ?? null,
      scriptures,
      userImported: src?.verification === "user_import",
    };
  }
  return {
    publication: "Arbeitsheft „Unser Leben und Dienst als Christ“",
    title: t.workbook.title,
    section: `${SECTION_TITLES[t.item.section]} · ${t.item.position}. ${t.item.title}`,
    date: src?.publishedAt ?? null,
    url: url ?? t.workbook.sourceUrl ?? null,
    verification: src?.verification ?? null,
    scriptures,
    userImported: src?.verification === "user_import",
  };
}
