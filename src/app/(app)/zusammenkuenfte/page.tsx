"use client";

import Link from "next/link";
import { BookMarked, BookOpenText, CheckCircle2, ChevronRight, Circle, Upload } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { PrepareButton } from "@/components/study/prepare-button";
import { SourcesPanel } from "@/components/study/sources-panel";
import { StatusDot } from "@/components/study/status-dot";
import { Container, PageHeader, ProgressBar, SectionBand, WeekSwitcher } from "@/components/study/ui";
import { ButtonLink } from "@/components/ui/button-link";
import { useData } from "@/lib/client/use-data";
import { importHref, itemHref, weekHref } from "@/lib/routes";
import { loadWeek, useWeekParam } from "@/lib/study/load";
import type { WorkbookSection } from "@/lib/types";
import { currentWeek, formatRange } from "@/lib/week";

const ORDER: WorkbookSection[] = ["schaetze", "dienst", "leben", "versammlungsbibelstudium"];

export default function MeetingWeekPage() {
  const range = useWeekParam();
  const { year, week } = range;
  const { data, error } = useData(() => loadWeek(year, week), [year, week]);
  const cw = currentWeek();
  const isCurrent = cw.year === year && cw.week === week;

  return (
    <Container>
      <WeekSwitcher base="/zusammenkuenfte" year={year} week={week} />
      {error ? (
        <LoadError error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <PageHeader eyebrow={isCurrent ? "Diese Woche" : `KW ${week}/${year}`} title="Zusammenkünfte">
            <span className="flex flex-wrap items-center gap-3">
              {formatRange(range.start, range.end)}
              {data.week && <StatusDot status={data.week.status} />}
            </span>
          </PageHeader>

          <div className="mb-8 rounded-2xl border bg-card p-5">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">Gesamtfortschritt</span>
              <span className="font-semibold text-brand-mid tabular-nums">{data.summary.percent} %</span>
            </div>
            <ProgressBar value={data.summary.percent} />
            <p className="mt-2 text-xs text-muted-foreground">
              Arbeitsheft: {data.summary.workbookDone} von {data.summary.workbookTotal} Punkten · Wachtturm: {data.summary.watchtowerDone} von{" "}
              {data.summary.watchtowerTotal} Absätzen
            </p>
            <PrepareButton
              className="mt-4"
              year={year}
              week={week}
              label={isCurrent ? "Jetzt diese Woche vorbereiten" : "Diese Woche vorbereiten"}
              notify={data.settings.notifications}
              initialJob={data.week?.prepJob}
              weekId={data.week?.id}
            />
          </div>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BookOpenText className="size-5 text-brand-mid" /> Leben und Dienst
              </h2>
              {data.workbook && (
                <Link href={weekHref("/arbeitsheft", year, week)} className="text-sm font-medium text-brand-mid hover:underline">
                  Öffnen
                </Link>
              )}
            </div>
            {data.workbook ? (
              <div className="space-y-3">
                {data.workbook.bibleReading && <p className="text-sm text-muted-foreground">Bibelleseprogramm: {data.workbook.bibleReading}</p>}
                {ORDER.map((section) => {
                  const items = data.workbook!.items.filter((i) => i.section === section);
                  if (!items.length) return null;
                  const prepared = new Set(data.progress.filter((x) => x.prepared).map((x) => x.targetId));
                  return (
                    <div key={section}>
                      <SectionBand section={section} />
                      <ul className="mt-1.5 divide-y rounded-xl border bg-card">
                        {items.map((it) => (
                          <li key={it.id}>
                            <Link href={itemHref(year, week, it.id)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40">
                              {prepared.has(it.id) ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground/50" />}
                              <span className="flex-1">
                                {it.position}. {it.title}
                              </span>
                              {it.duration && <span className="text-xs text-muted-foreground">{it.duration}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">
                Noch nicht importiert.
                <ButtonLink size="sm" variant="outline" className="ml-3" href={importHref(year, week, "workbook")}>
                  <Upload /> Arbeitsheft importieren
                </ButtonLink>
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <BookMarked className="size-5 text-brand-mid" /> Wachtturm-Studium
            </h2>
            {data.article ? (
              <Link href={weekHref("/wachtturm", year, week)} className="group block rounded-2xl border bg-card p-5 hover:border-brand-mid/40">
                <p className="eyebrow text-gold">
                  {data.article.studyNumber ? `Studienartikel ${data.article.studyNumber}` : "Studienartikel"}
                  {data.article.issue && ` · ${data.article.issue}`}
                </p>
                <p className="mt-1 text-lg font-semibold">{data.article.title}</p>
                {data.article.themeScripture && <p className="reading-sm mt-2 text-muted-foreground italic">{data.article.themeScripture}</p>}
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <ProgressBar
                    value={data.summary.watchtowerTotal ? (data.summary.watchtowerDone / data.summary.watchtowerTotal) * 100 : 0}
                    className="max-w-48"
                  />
                  <span className="text-muted-foreground">
                    {data.summary.watchtowerDone} von {data.summary.watchtowerTotal} Absätzen
                  </span>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground group-hover:text-foreground" />
                </div>
              </Link>
            ) : (
              <div className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">
                Noch nicht importiert.
                <ButtonLink size="sm" variant="outline" className="ml-3" href={importHref(year, week, "watchtower")}>
                  <Upload /> Wachtturm importieren
                </ButtonLink>
              </div>
            )}
          </section>

          {data.week ? (
            <SourcesPanel weekId={data.week.id} sources={data.sources} />
          ) : (
            <p className="text-sm text-muted-foreground">Quellen werden angezeigt, sobald die Woche vorbereitet wurde.</p>
          )}
        </>
      )}
    </Container>
  );
}
