"use client";

import { ClipboardPaste } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { MeetingSheet, MeetingToolbar } from "@/components/study/meeting-sheet";
import { SourcesPanel } from "@/components/study/sources-panel";
import { StatusDot } from "@/components/study/status-dot";
import { Container, PageHeader, WeekSwitcher } from "@/components/study/ui";
import { ButtonLink } from "@/components/ui/button-link";
import { isAiReady } from "@/lib/actions";
import { useData } from "@/lib/client/use-data";
import { importHref } from "@/lib/routes";
import { loadWeek, useWeekParam } from "@/lib/study/load";
import { currentWeek, formatRange } from "@/lib/week";

/** Startseite = die Woche: Arbeitsheft und Wachtturm-Studium auf einer Seite. */
export default function WeekPage() {
  const range = useWeekParam();
  const { year, week } = range;
  const { data, error } = useData(async () => ({ ...(await loadWeek(year, week)), ai: await isAiReady() }), [year, week]);
  const cw = currentWeek();
  const isCurrent = cw.year === year && cw.week === week;

  return (
    <Container>
      <WeekSwitcher year={year} week={week} />
      {error ? (
        <LoadError error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <PageHeader title={isCurrent ? "Diese Woche" : `Woche ${formatRange(range.start, range.end)}`}>
            {data.week && <StatusDot status={data.week.status} />}
          </PageHeader>

          <MeetingToolbar year={year} week={week} data={data} aiEnabled={data.ai} />

          <MeetingSheet data={data} year={year} week={week} />

          <div className="mt-3 flex flex-wrap justify-end gap-2 text-sm">
            <span className="mr-auto self-center text-xs text-muted-foreground">Falls das Laden nicht klappt:</span>
            <ButtonLink size="sm" variant="ghost" href={importHref(year, week, "workbook", "text")}>
              <ClipboardPaste /> Text einfügen
            </ButtonLink>
          </div>

          {data.week && (
            <div className="mt-8">
              <SourcesPanel weekId={data.week.id} sources={data.sources} />
            </div>
          )}
        </>
      )}
    </Container>
  );
}
