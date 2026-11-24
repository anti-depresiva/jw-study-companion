"use client";

import Link from "next/link";
import { BookOpenText, CheckCircle2, ChevronRight, Circle, ExternalLink, Upload } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { Container, EmptyState, PageHeader, ProgressBar, SectionBand, WeekSwitcher, sectionLetter } from "@/components/study/ui";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button-link";
import { useData } from "@/lib/client/use-data";
import { importHref, itemHref } from "@/lib/routes";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { bibleLookupUrl } from "@/lib/sources/links";
import { loadWeek, useWeekParam } from "@/lib/study/load";
import type { WorkbookSection } from "@/lib/types";

const ORDER: WorkbookSection[] = ["schaetze", "dienst", "leben", "versammlungsbibelstudium"];

export default function WorkbookPage() {
  const { year, week } = useWeekParam();
  const { data, error } = useData(() => loadWeek(year, week), [year, week]);
  return (
    <Container>
      <WeekSwitcher base="/arbeitsheft" year={year} week={week} />
      {error ? <LoadError error={error} /> : !data ? <Loading /> : <Workbook data={data} year={year} week={week} />}
    </Container>
  );
}

function Workbook({ data, year, week }: { data: Awaited<ReturnType<typeof loadWeek>>; year: number; week: number }) {
  const { workbook, progress, answers, summary, sources } = data;
  const prepared = new Set(progress.filter((x) => x.prepared).map((x) => x.targetId));
  const answered = new Set(answers.map((a) => a.targetId));
  const officialUrl = workbook?.sourceUrl && checkOfficialUrl(workbook.sourceUrl).ok ? workbook.sourceUrl : null;
  const found = sources.find((s) => (s.kind === "workbook" || s.kind === "other") && s.url && s.verification !== "rejected");

  if (!workbook) {
    return (
      <EmptyState icon={BookOpenText} title="Für diese Woche ist noch kein Arbeitsheft importiert">
        <p>Lade das Arbeitsheft „Unser Leben und Dienst als Christ“ in der jw.org-App oder auf jw.org als PDF herunter und importiere es. Eine Ausgabe enthält zwei Monate.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <ButtonLink href={importHref(year, week, "workbook")}>
            <Upload /> Arbeitsheft importieren
          </ButtonLink>
          {found?.url && (
            <ExternalButtonLink variant="outline" href={found.url}>
              Auf jw.org öffnen <ExternalLink />
            </ExternalButtonLink>
          )}
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Unser Leben und Dienst als Christ" title={workbook.title}>
        {workbook.bibleReading && (
          <p>
            Bibelleseprogramm:{" "}
            <a href={bibleLookupUrl(workbook.bibleReading)} target="_blank" rel="noopener noreferrer" className="font-medium text-success hover:underline">
              {workbook.bibleReading}
            </a>
          </p>
        )}
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {summary.workbookDone} von {summary.workbookTotal} Punkten vorbereitet
        </span>
        <ProgressBar value={summary.workbookTotal ? (summary.workbookDone / summary.workbookTotal) * 100 : 0} className="max-w-48" />
        {officialUrl && (
          <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-brand-mid hover:underline">
            Original auf jw.org <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <div className="space-y-6">
        {ORDER.map((section) => {
          const items = workbook.items.filter((i) => i.section === section);
          if (!items.length) return null;
          return (
            <section key={section}>
              <SectionBand section={section}>
                <span className="text-xs font-semibold text-white/80">{sectionLetter(section)}</span>
              </SectionBand>
              <ul className="mt-2 divide-y rounded-xl border bg-card">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link href={itemHref(year, week, item.id)} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
                      <span className="w-6 text-sm font-semibold text-muted-foreground tabular-nums">{item.position}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {[item.duration, item.questions.length ? `${item.questions.length} Frage(n)` : null, answered.has(item.id) ? "KI-Antworten bereit" : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {prepared.has(item.id) ? (
                        <CheckCircle2 className="size-5 text-success" aria-label="Vorbereitet" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground/50" aria-label="Offen" />
                      )}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <ButtonLink variant="ghost" size="sm" href={importHref(year, week, "workbook")}>
          Neu importieren
        </ButtonLink>
      </div>
    </div>
  );
}
