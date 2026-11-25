"use client";

import { useSearchParams } from "next/navigation";
import { BookMarked } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { StudyView } from "@/components/study/study-view";
import { Container, EmptyState } from "@/components/study/ui";
import { isAiReady } from "@/lib/actions";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";
import { paragraphHref, weekHref } from "@/lib/routes";
import { loadWeek, useWeekParam } from "@/lib/study/load";
import { resolveTarget } from "@/lib/study/targets";
import { buildStudyViewProps } from "@/lib/study/view-props";

export default function ParagraphPage() {
  const { year, week } = useWeekParam();
  const n = Number(useSearchParams().get("n"));
  const { data, error } = useData(async () => {
    const wd = await loadWeek(year, week);
    const index = n - 1;
    if (!wd.week || !wd.article || !Number.isInteger(index) || index < 0 || index >= wd.article.paragraphs.length) return null;
    const article = wd.article;
    const [target, favorites, ai] = await Promise.all([
      resolveTarget(store, wd.week.id, "paragraph", article.paragraphs[index].id),
      store.listFavorites(),
      isAiReady(),
    ]);
    const prev = article.paragraphs[index - 1];
    const next = article.paragraphs[index + 1];
    return buildStudyViewProps(target, wd, favorites, ai, {
      backHref: weekHref(year, week, `absatz-${n}`),
      backLabel: "Studienartikel",
      position: `${index + 1} / ${article.paragraphs.length}`,
      prev: prev ? { href: paragraphHref(year, week, index), label: `Absatz ${prev.number}` } : null,
      next: next ? { href: paragraphHref(year, week, index + 2), label: `Absatz ${next.number}` } : null,
    });
  }, [year, week, n]);

  return (
    <Container>
      {error ? (
        <LoadError error={error} />
      ) : data === undefined ? (
        <Loading />
      ) : data === null ? (
        <EmptyState icon={BookMarked} title="Absatz nicht gefunden" />
      ) : (
        <StudyView key={data.targetId} {...data} />
      )}
    </Container>
  );
}
