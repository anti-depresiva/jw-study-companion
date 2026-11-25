"use client";

import { useSearchParams } from "next/navigation";
import { BookOpenText } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { StudyView } from "@/components/study/study-view";
import { Container, EmptyState } from "@/components/study/ui";
import { isAiReady } from "@/lib/actions";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";
import { itemHref, weekHref } from "@/lib/routes";
import { loadWeek, useWeekParam } from "@/lib/study/load";
import { resolveTarget } from "@/lib/study/targets";
import { buildStudyViewProps } from "@/lib/study/view-props";

export default function WorkbookItemPage() {
  const { year, week } = useWeekParam();
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(async () => {
    const wd = await loadWeek(year, week);
    const items = wd.workbook?.items ?? [];
    const index = items.findIndex((i) => i.id === id);
    if (!wd.week || index < 0) return null;
    const [target, favorites, ai] = await Promise.all([resolveTarget(store, wd.week.id, "workbook_item", id), store.listFavorites(), isAiReady()]);
    const prev = items[index - 1];
    const next = items[index + 1];
    return buildStudyViewProps(target, wd, favorites, ai, {
      backHref: weekHref(year, week, `punkt-${id}`),
      backLabel: "Zur Woche",
      position: `${index + 1} / ${items.length}`,
      prev: prev ? { href: itemHref(year, week, prev.id), label: `${prev.position}. ${prev.title}` } : null,
      next: next ? { href: itemHref(year, week, next.id), label: `${next.position}. ${next.title}` } : null,
    });
  }, [year, week, id]);

  return (
    <Container>
      {error ? (
        <LoadError error={error} />
      ) : data === undefined ? (
        <Loading />
      ) : data === null ? (
        <EmptyState icon={BookOpenText} title="Programmpunkt nicht gefunden" />
      ) : (
        <StudyView key={data.targetId} {...data} />
      )}
    </Container>
  );
}
