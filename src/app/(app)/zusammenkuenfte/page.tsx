"use client";

import { ClipboardPaste, FileUp } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { MeetingSheet, MeetingToolbar } from "@/components/study/meeting-sheet";
import { PrepareButton } from "@/components/study/prepare-button";
import { SourcesPanel } from "@/components/study/sources-panel";
import { StatusDot } from "@/components/study/status-dot";
import { WeekImages } from "@/components/study/week-images";
import { Container, PageHeader, ProgressBar, WeekSwitcher } from "@/components/study/ui";
import { ButtonLink } from "@/components/ui/button-link";
import { isAiReady } from "@/lib/actions";
import { useData } from "@/lib/client/use-data";
import { importHref } from "@/lib/routes";
import { loadWeek, useWeekParam } from "@/lib/study/load";
import { currentWeek, formatRange } from "@/lib/week";

export default function MeetingWeekPage() {
  const range = useWeekParam();
  const { year, week } = range;
  const { data, error } = useData(async () => ({ ...(await loadWeek(year, week)), ai: await isAiReady() }), [year, week]);
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

          <MeetingToolbar year={year} week={week} data={data} aiEnabled={data.ai} />

          {data.week && (
            <>
              <WeekImages weekId={data.week.id} kind="workbook" className="mb-4" />
              <WeekImages weekId={data.week.id} kind="watchtower" className="mb-4" />
            </>
          )}

          {data.week ? (
            <MeetingSheet data={data} year={year} week={week} />
          ) : (
            <div className="rounded-2xl border border-dashed bg-surface p-8 text-center text-sm text-muted-foreground">
              Für diese Woche sind noch keine Inhalte vorhanden. Lade sie oben von wol.jw.org.
            </div>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2 text-sm">
            <span className="mr-auto self-center text-xs text-muted-foreground">Andere Wege:</span>
            <ButtonLink size="sm" variant="ghost" href={importHref(year, week, "workbook", "text")}>
              <ClipboardPaste /> Text einfügen
            </ButtonLink>
            <ButtonLink size="sm" variant="ghost" href={importHref(year, week, "workbook", "pdf")}>
              <FileUp /> PDF
            </ButtonLink>
          </div>

          <div className="mt-8 rounded-2xl border bg-card p-5">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">Vorbereitung</span>
              <span className="font-semibold text-brand-mid tabular-nums">{data.summary.percent} %</span>
            </div>
            <ProgressBar value={data.summary.percent} />
            <p className="mt-2 text-xs text-muted-foreground">
              Arbeitsheft: {data.summary.workbookDone} von {data.summary.workbookTotal} Punkten · Wachtturm: {data.summary.watchtowerDone} von{" "}
              {data.summary.watchtowerTotal} Absätzen als vorbereitet markiert
            </p>
            <PrepareButton
              className="mt-4"
              year={year}
              week={week}
              label="Drei Antwortvarianten für alle erstellen"
              notify={data.settings.notifications}
              initialJob={data.week?.prepJob}
              weekId={data.week?.id}
            />
          </div>

          <div className="mt-8">
            {data.week ? (
              <SourcesPanel weekId={data.week.id} sources={data.sources} />
            ) : (
              <p className="text-sm text-muted-foreground">Quellen werden angezeigt, sobald die Woche angelegt wurde.</p>
            )}
          </div>
        </>
      )}
    </Container>
  );
}
