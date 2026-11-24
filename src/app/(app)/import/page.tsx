"use client";

import { useSearchParams } from "next/navigation";
import { Download, ExternalLink, ShieldCheck } from "lucide-react";
import { ImportWizard } from "@/components/import/import-wizard";
import { LoadError, Loading } from "@/components/study/loading";
import { Container, PageHeader } from "@/components/study/ui";
import { isAiReady } from "@/lib/actions";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { MAGAZINE_INDEX_URL, WORKBOOK_INDEX_URL } from "@/lib/sources/links";
import { useWeekParam } from "@/lib/study/load";
import { formatRange } from "@/lib/week";

export default function ImportPage() {
  const range = useWeekParam();
  const { year, week } = range;
  const sp = useSearchParams();
  const kind = sp.get("type") === "workbook" ? "workbook" : "watchtower";
  const m = sp.get("mode");
  const mode = m === "text" || m === "manual" ? m : "pdf";

  const { data, error } = useData(async () => {
    const w = await store.ensureWeek(year, week);
    const [sources, existing, ai] = await Promise.all([
      store.listSources(w.id),
      kind === "watchtower" ? store.getArticle(w.id) : store.getWorkbook(w.id),
      isAiReady(),
    ]);
    const suggestedUrls = sources
      .filter((s) => s.url && s.verification !== "rejected" && (s.kind === kind || s.kind === "other") && checkOfficialUrl(s.url).ok)
      .sort((a, b) => (a.kind === kind ? -1 : 0) - (b.kind === kind ? -1 : 0))
      .map((s) => ({ title: s.title, url: s.url! }));
    return { weekId: w.id, hasExisting: Boolean(existing), suggestedUrls, ai };
  }, [year, week, kind]);

  const downloadPage = kind === "watchtower" ? MAGAZINE_INDEX_URL : WORKBOOK_INDEX_URL;

  return (
    <Container>
      <PageHeader
        eyebrow={`KW ${week}/${year} · ${formatRange(range.start, range.end)}`}
        title={kind === "watchtower" ? "Wachtturm-Studienartikel importieren" : "Arbeitsheft-Woche importieren"}
      >
        <p className="flex items-start gap-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          Die Datei wird nur auf deinem iPhone ausgelesen und gespeichert. Absätze und Fragen werden wörtlich übernommen und gegen deine Vorlage geprüft.
        </p>
      </PageHeader>

      <ol className="mb-6 space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <li className="flex items-start gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[0.7rem] font-semibold text-primary-foreground">1</span>
          <span>
            {kind === "watchtower" ? "Wachtturm-Studienausgabe" : "Arbeitsheft"} auf jw.org öffnen und als <strong>PDF herunterladen</strong> (in Safari: Datei wird unter „Downloads“ gespeichert).
            <a href={downloadPage} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex w-fit items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
              <Download className="size-4" /> Auf jw.org herunterladen <ExternalLink className="size-3.5" />
            </a>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[0.7rem] font-semibold text-primary-foreground">2</span>
          <span>Unten „PDF hochladen“ wählen und die Datei aus „Downloads“ auswählen. Eine Ausgabe enthält mehrere Wochen.</span>
        </li>
      </ol>

      {error ? (
        <LoadError error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <ImportWizard
          kind={kind}
          weekId={data.weekId}
          year={year}
          week={week}
          weekLabel={formatRange(range.start, range.end)}
          initialMode={mode}
          hasExisting={data.hasExisting}
          suggestedUrls={data.suggestedUrls}
          aiEnabled={data.ai}
        />
      )}
    </Container>
  );
}
