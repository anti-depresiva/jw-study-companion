"use client";

import Link from "next/link";
import { BookMarked, CheckCircle2, Circle, ExternalLink, Upload } from "lucide-react";
import { ContentLabel } from "@/components/study/labels";
import { LoadError, Loading } from "@/components/study/loading";
import { Container, EmptyState, PageHeader, ProgressBar, WeekSwitcher } from "@/components/study/ui";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/button-link";
import { useData } from "@/lib/client/use-data";
import { importHref, paragraphHref } from "@/lib/routes";
import { findScriptures } from "@/lib/scripture";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { bibleLookupUrl } from "@/lib/sources/links";
import { loadWeek, useWeekParam } from "@/lib/study/load";

export default function WatchtowerArticlePage() {
  const { year, week } = useWeekParam();
  const { data, error } = useData(() => loadWeek(year, week), [year, week]);

  return (
    <Container>
      <WeekSwitcher base="/wachtturm" year={year} week={week} />
      {error ? <LoadError error={error} /> : !data ? <Loading /> : <Article data={data} year={year} week={week} />}
    </Container>
  );
}

function Article({ data, year, week }: { data: Awaited<ReturnType<typeof loadWeek>>; year: number; week: number }) {
  const { article, progress, answers, summary, sources } = data;
  const prepared = new Set(progress.filter((x) => x.prepared).map((x) => x.targetId));
  const answered = new Set(answers.map((a) => a.targetId));
  const officialUrl = article?.sourceUrl && checkOfficialUrl(article.sourceUrl).ok ? article.sourceUrl : null;
  const found = sources.find((s) => (s.kind === "watchtower" || s.kind === "other") && s.url && s.verification !== "rejected");

  if (!article) {
    return (
      <EmptyState icon={BookMarked} title="Für diese Woche ist noch kein Studienartikel importiert">
        <p>Lade die Wachtturm-Studienausgabe in der jw.org-App oder auf jw.org als PDF herunter und importiere sie – die App sucht den Artikel dieser Woche heraus.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <ButtonLink href={importHref(year, week, "watchtower")}>
            <Upload /> Studienartikel importieren
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
    <article className="fade-in">
      <PageHeader
        eyebrow={
          <>
            Wachtturm-Studium{article.studyNumber && ` · Studienartikel ${article.studyNumber}`}
            {article.issue && ` · ${article.issue}`}
          </>
        }
        title={article.title}
      />
      <div className="mb-6 space-y-3">
        {article.song && <p className="eyebrow text-muted-foreground">{article.song}</p>}
        {article.themeScripture && (
          <blockquote className="reading border-l-[3px] border-gold pl-4 italic">
            {article.themeScripture}
            {findScriptures(article.themeScripture).map((r) => (
              <a key={r.label} href={bibleLookupUrl(r.label)} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm text-success not-italic hover:underline">
                {r.label}
              </a>
            ))}
          </blockquote>
        )}
        {article.intro && (
          <div className="rounded-xl bg-accent/60 p-4">
            <p className="eyebrow mb-1 text-brand-mid">Vorschau</p>
            <p className="reading-sm">{article.intro}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {summary.watchtowerDone} von {summary.watchtowerTotal} Absätzen vorbereitet
          </span>
          <ProgressBar value={summary.watchtowerTotal ? (summary.watchtowerDone / summary.watchtowerTotal) * 100 : 0} className="max-w-48" />
          {officialUrl && (
            <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-brand-mid hover:underline">
              Originalartikel <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      <ContentLabel kind="original" className="mb-3" />
      <ol className="divide-y rounded-2xl border bg-card">
        {article.paragraphs.map((para, i) => (
          <li key={para.id}>
            <Link href={paragraphHref(year, week, i + 1)} className="group block px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 min-w-9 rounded-md bg-secondary px-1.5 py-0.5 text-center text-sm font-semibold text-brand tabular-nums">{para.number}</span>
                <div className="min-w-0 flex-1">
                  {para.question && <p className="mb-1.5 font-semibold text-foreground">{para.question}</p>}
                  <p className="reading-sm line-clamp-3 text-muted-foreground">{para.originalText}</p>
                </div>
                <span className="mt-1 flex shrink-0 flex-col items-center gap-1">
                  {prepared.has(para.id) ? (
                    <CheckCircle2 className="size-5 text-success" aria-label="Vorbereitet" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground/50" aria-label="Offen" />
                  )}
                  {answered.has(para.id) && <span className="size-1.5 rounded-full bg-gold" title="KI-Antworten vorhanden" />}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex justify-end">
        <ButtonLink variant="ghost" size="sm" href={importHref(year, week, "watchtower")}>
          Neu importieren
        </ButtonLink>
      </div>
    </article>
  );
}
