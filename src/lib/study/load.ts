"use client";

import { useSearchParams } from "next/navigation";
import { store } from "@/lib/data";
import { currentWeek, weekRange, weeksInIsoYear, type WeekRange } from "@/lib/week";
import { summarizeProgress } from "./progress";

/** Liest ?y=…&w=… aus der Adresse; ohne Angabe die aktuelle Woche. */
export function useWeekParam(): WeekRange {
  const sp = useSearchParams();
  const year = Number(sp.get("y"));
  const week = Number(sp.get("w"));
  if (Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(week) && week >= 1 && week <= weeksInIsoYear(year)) {
    return weekRange(year, week);
  }
  return currentWeek();
}

/** Lädt alle Daten einer Woche aus dem Gerätespeicher. */
export async function loadWeek(year: number, week: number) {
  const [settings, weekRow] = await Promise.all([store.getSettings(), store.getWeek(year, week)]);
  if (!weekRow) {
    return {
      settings,
      week: null,
      article: null,
      workbook: null,
      progress: [],
      answers: [],
      notes: [],
      sources: [],
      summary: summarizeProgress(null, null, []),
    };
  }
  const [article, workbook, progress, answers, notes, sources] = await Promise.all([
    store.getArticle(weekRow.id),
    store.getWorkbook(weekRow.id),
    store.listProgress(weekRow.id),
    store.listAnswers(weekRow.id),
    store.listNotes(weekRow.id),
    store.listSources(weekRow.id),
  ]);
  return { settings, week: weekRow, article, workbook, progress, answers, notes, sources, summary: summarizeProgress(article, workbook, progress) };
}

export type WeekData = Awaited<ReturnType<typeof loadWeek>>;
