"use client";

import Link from "next/link";
import { Archive, ChevronRight } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { StatusDot } from "@/components/study/status-dot";
import { Container, EmptyState, PageHeader, ProgressBar } from "@/components/study/ui";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";
import { weekHref } from "@/lib/routes";
import { summarizeProgress } from "@/lib/study/progress";
import { formatRange } from "@/lib/week";

async function loadArchive() {
  const weeks = await store.listWeeks();
  return Promise.all(
    weeks.map(async (w) => {
      const [article, workbook, progress, notes, answers] = await Promise.all([
        store.getArticle(w.id),
        store.getWorkbook(w.id),
        store.listProgress(w.id),
        store.listNotes(w.id),
        store.listAnswers(w.id),
      ]);
      return { w, article, workbook, notes: notes.length, answers: answers.length, summary: summarizeProgress(article, workbook, progress) };
    }),
  );
}

export default function ArchivePage() {
  const { data: rows, error } = useData(loadArchive, []);
  const byYear = new Map<number, NonNullable<typeof rows>>();
  for (const r of rows ?? []) byYear.set(r.w.year, [...(byYear.get(r.w.year) ?? []), r]);

  return (
    <Container>
      <PageHeader eyebrow="Persönliche Studienbibliothek" title="Wochenarchiv">
        Alle vorbereiteten Wochen mit Antworten, Notizen und Quellen – gespeichert auf diesem Gerät.
      </PageHeader>
      {error ? (
        <LoadError error={error} />
      ) : !rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={Archive} title="Noch keine Wochen gespeichert">
          Sobald du eine Woche vorbereitest, erscheint sie hier dauerhaft.
        </EmptyState>
      ) : (
        [...byYear.entries()].map(([year, list]) => (
          <section key={year} className="mb-8">
            <h2 className="eyebrow mb-2 text-muted-foreground">{year}</h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {list.map(({ w, article, workbook, notes, answers, summary }) => (
                <li key={w.id}>
                  <Link href={weekHref(w.year, w.week)} className="group flex items-center gap-4 px-4 py-4 hover:bg-muted/40 sm:px-5">
                    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                      <span className="text-[0.6rem] font-semibold uppercase">KW</span>
                      <span className="text-lg leading-none font-semibold tabular-nums">{w.week}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium">{formatRange(w.start, w.end)}</span>
                        <StatusDot status={w.status} />
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {[article?.title, workbook?.bibleReading].filter(Boolean).join(" · ") || "Noch keine Inhalte"}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <ProgressBar value={summary.percent} className="max-w-32" />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {summary.percent} % · {answers} Antworten · {notes} Notizen
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Container>
  );
}
