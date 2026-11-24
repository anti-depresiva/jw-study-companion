import type { Article, ProgressEntry, Workbook } from "@/lib/types";

export interface ProgressSummary {
  workbookDone: number;
  workbookTotal: number;
  watchtowerDone: number;
  watchtowerTotal: number;
  percent: number;
}

export function summarizeProgress(
  article: Article | null,
  workbook: Workbook | null,
  progress: ProgressEntry[],
): ProgressSummary {
  const prepared = new Set(progress.filter((p) => p.prepared).map((p) => `${p.targetType}:${p.targetId}`));
  const wbIds = workbook?.items.map((i) => i.id) ?? [];
  const wtIds = article?.paragraphs.map((p) => p.id) ?? [];
  const workbookDone = wbIds.filter((id) => prepared.has(`workbook_item:${id}`)).length;
  const watchtowerDone = wtIds.filter((id) => prepared.has(`paragraph:${id}`)).length;
  const total = wbIds.length + wtIds.length;
  return {
    workbookDone,
    workbookTotal: wbIds.length,
    watchtowerDone,
    watchtowerTotal: wtIds.length,
    percent: total ? Math.round(((workbookDone + watchtowerDone) / total) * 100) : 0,
  };
}
