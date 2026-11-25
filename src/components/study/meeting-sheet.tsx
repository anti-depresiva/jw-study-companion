"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  CloudDownload,
  ExternalLink,
  Loader2,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/ai/client";
import * as actions from "@/lib/actions";
import { itemHref, paragraphHref } from "@/lib/routes";
import type { WeekData } from "@/lib/study/load";
import type {
  AnswerField,
  TargetType,
  WorkbookItem,
  WorkbookSection,
} from "@/lib/types";
import { SECTION_TITLES } from "@/lib/types";
import { formatRange, weekRange } from "@/lib/week";
import { cn } from "@/lib/utils";
import { AnswerBox } from "./answer-box";
import { HighlightScope, MarkedText } from "./highlighter";
import { RichText } from "./rich-text";

const ORDER: WorkbookSection[] = [
  "schaetze",
  "dienst",
  "leben",
  "versammlungsbibelstudium",
];
const SECTION_TEXT: Record<WorkbookSection, string> = {
  schaetze: "text-sec-schaetze",
  dienst: "text-sec-dienst",
  leben: "text-sec-leben",
  versammlungsbibelstudium: "text-sec-leben",
};
const SECTION_BAR: Record<WorkbookSection, string> = {
  schaetze: "bg-sec-schaetze",
  dienst: "bg-sec-dienst",
  leben: "bg-sec-leben",
  versammlungsbibelstudium: "bg-sec-leben",
};

/**
 * Kopierter Text bricht oft mitten im Satz um – Zeilen zu Absätzen zusammenführen.
 * Ein neuer Absatz beginnt nach Satzende oder bei Aufzählungen („˙ Wie …“, „VON HAUS ZU HAUS.“).
 */
function toParagraphs(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out[out.length - 1];
    const startsNew = /^[˙•·–-]\s/.test(line) || /^[A-ZÄÖÜ ]{6,}\./.test(line);
    if (prev !== undefined && !startsNew && !/[.!?:)“]$/.test(prev))
      out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

function fieldOf(
  fields: AnswerField[],
  type: TargetType,
  id: string,
  index: number,
) {
  return (
    fields.find(
      (f) => f.targetType === type && f.targetId === id && f.index === index,
    ) ?? null
  );
}

/** Oberer Bereich: Woche laden und alle Felder ausfüllen. */
export function MeetingToolbar({
  year,
  week,
  data,
  aiEnabled,
}: {
  year: number;
  week: number;
  data: WeekData;
  aiEnabled: boolean;
}) {
  const [busy, setBusy] = useState<null | "load" | "fill">(null);
  const [step, setStep] = useState("");
  const hasContent = Boolean(data.workbook || data.article);

  async function load() {
    if (
      hasContent &&
      !confirm(
        "Diese Woche ist bereits vorhanden. Neu von wol.jw.org laden? Selbst geschriebene Antworten in den Feldern bleiben nur erhalten, wenn die Fragen gleich bleiben.",
      )
    )
      return;
    setBusy("load");
    try {
      const res = await actions.importFromWol(year, week, {
        overwrite: true,
        onStep: setStep,
      });
      toast.success(
        [
          res.workbookItems && `${res.workbookItems} Programmpunkte`,
          res.paragraphs && `${res.paragraphs} Wachtturm-Absätze`,
        ]
          .filter(Boolean)
          .join(" und ") + " geladen.",
      );
      res.notes.forEach((n) => toast(n));
    } catch (err) {
      toast.error(friendlyError(err), { duration: 9000 });
    } finally {
      setBusy(null);
      setStep("");
    }
  }

  async function fill() {
    if (!data.week) return;
    setBusy("fill");
    try {
      const res = await actions.fillWeekFields(data.week.id, (d, t) =>
        setStep(`${d} von ${t} Abschnitten ausgefüllt …`),
      );
      if (res.errors.length) toast.error(res.errors[0], { duration: 9000 });
      else toast.success("Alle Felder ausgefüllt.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(null);
      setStep("");
    }
  }

  return (
    <div className="mb-6 rounded-2xl border bg-card p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          onClick={load}
          disabled={busy !== null || !aiEnabled}
          variant={hasContent ? "outline" : "default"}
          className="h-11"
        >
          {busy === "load" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <CloudDownload />
          )}
          {hasContent
            ? "Neu von wol.jw.org laden"
            : "Woche von wol.jw.org laden"}
        </Button>
        <Button
          onClick={fill}
          disabled={busy !== null || !aiEnabled || !hasContent}
          className="h-11"
        >
          {busy === "fill" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          Alle Felder ausfüllen
        </Button>
      </div>
      {step && (
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {step} Bitte die App geöffnet lassen.
        </p>
      )}
      {!aiEnabled && (
        <p className="mt-2 text-sm text-muted-foreground">
          Für Laden und Ausfüllen wird der Anthropic-API-Schlüssel benötigt –{" "}
          <Link href="/einstellungen/#ki" className="text-brand-mid underline">
            in den Einstellungen eintragen
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Ein Programmpunkt: Titel, Dauer, Text – unter jeder Frage ein Antwortfeld. */
function ItemBlock({
  item,
  data,
  year,
  week,
  color,
}: {
  item: WorkbookItem;
  data: WeekData;
  year: number;
  week: number;
  color: string;
}) {
  const target = {
    weekId: data.week!.id,
    targetType: "workbook_item" as const,
    targetId: item.id,
  };
  const prepared = data.progress.some(
    (p) => p.targetId === item.id && p.prepared,
  );
  const lines = toParagraphs(item.originalText);
  const placed = new Set<number>();
  const box = (i: number) => {
    placed.add(i);
    const f = fieldOf(data.fields, "workbook_item", item.id, i);
    return (
      <AnswerBox
        key={`box-${i}`}
        target={target}
        index={i}
        initial={f?.text ?? ""}
        origin={f?.origin ?? null}
      />
    );
  };

  return (
    <article id={`punkt-${item.id}`} className="scroll-mt-4 py-4">
      <h3 className={cn("text-[1.05rem] font-semibold", color)}>
        <Link
          href={itemHref(year, week, item.id)}
          className="group inline-flex items-start gap-1.5 hover:underline"
        >
          {item.position}. {item.title}
          {prepared && (
            <CheckCircle2
              className="mt-1 size-4 shrink-0 text-success"
              aria-label="Vorbereitet"
            />
          )}
        </Link>
      </h3>
      {item.duration && (
        <p className="mb-2 text-sm text-muted-foreground">({item.duration})</p>
      )}
      <div className="reading-sm space-y-1.5">
        {lines.map((line, li) => {
          const flat = line.replace(/\s+/g, " ");
          const here = item.questions
            .map((q, qi) => qi)
            .filter(
              (qi) =>
                !placed.has(qi) &&
                flat.includes(
                  item.questions[qi].replace(/\s+/g, " ").slice(-25),
                ),
            );
          return (
            <div key={li}>
              <p>
                <MarkedText block={`wb:${item.position}:${li}`} text={line} />
              </p>
              {here.map((qi) => box(qi))}
            </div>
          );
        })}
        {/* Fragen, die über mehrere Zeilen gehen */}
        {item.questions.map((_, i) => (placed.has(i) ? null : box(i)))}
      </div>
      {item.material && (
        <MaterialBlock
          item={item}
          weekId={data.week!.id}
          fields={data.fields}
        />
      )}
      <Link
        href={itemHref(year, week, item.id)}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-mid hover:underline"
      >
        Antwortvarianten, Kommentare &amp; Notiz{" "}
        <ChevronRight className="size-3.5" />
      </Link>
    </article>
  );
}

/** Die ganze Woche auf einer Seite – im Aufbau der Online-Bibliothek. */
export function MeetingSheet({
  data,
  year,
  week,
}: {
  data: WeekData;
  year: number;
  week: number;
}) {
  const r = weekRange(year, week);
  const { workbook, article } = data;

  if (!data.week) {
    return (
      <div className="rounded-2xl border border-dashed bg-surface p-8 text-center text-sm text-muted-foreground">
        <PencilLine className="mx-auto mb-2 size-6" />
        Für diese Woche sind noch keine Inhalte vorhanden. Lade sie oben von
        wol.jw.org.
      </div>
    );
  }

  return (
    <HighlightScope weekId={data.week.id} highlights={data.highlights}>
      <div className="rounded-2xl border bg-card px-4 pb-4 sm:px-6">
        {workbook && (
          <section className="pt-5">
            <p className="eyebrow text-muted-foreground">
              {formatRange(r.start, r.end).toUpperCase()}
            </p>
            {workbook.bibleReading && (
              <h2 className="mt-1 text-xl font-semibold tracking-wide uppercase">
                <RichText text={workbook.bibleReading} />
              </h2>
            )}
            {ORDER.map((section) => {
              const items = workbook.items.filter((i) => i.section === section);
              if (!items.length) return null;
              return (
                <div key={section} className="mt-5">
                  {section !== "versammlungsbibelstudium" ||
                  !workbook.items.some((i) => i.section === "leben") ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-5 w-1 rounded-full",
                          SECTION_BAR[section],
                        )}
                        aria-hidden
                      />
                      <h2
                        className={cn(
                          "eyebrow text-[0.8rem]",
                          SECTION_TEXT[section],
                        )}
                      >
                        {SECTION_TITLES[section]}
                      </h2>
                    </div>
                  ) : null}
                  <div className="divide-y">
                    {items.map((item) => (
                      <ItemBlock
                        key={item.id}
                        item={item}
                        data={data}
                        year={year}
                        week={week}
                        color={SECTION_TEXT[section]}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {article && (
          <section className={cn("pt-5", workbook && "mt-4 border-t")}>
            <div className="flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-brand-mid" aria-hidden />
              <h2 className="eyebrow text-[0.8rem] text-brand-mid">
                Wachtturm-Studium
              </h2>
            </div>
            <h3 className="mt-2 text-lg font-semibold">{article.title}</h3>
            {article.themeScripture && (
              <p className="reading-sm mt-1 text-muted-foreground italic">
                <RichText text={article.themeScripture} />
              </p>
            )}
            <div className="mt-3 divide-y">
              {article.paragraphs.map((p, i) => {
                const f = fieldOf(data.fields, "paragraph", p.id, 0);
                const target = {
                  weekId: data.week!.id,
                  targetType: "paragraph" as const,
                  targetId: p.id,
                };
                return (
                  <div
                    key={p.id}
                    id={`absatz-${i + 1}`}
                    className="scroll-mt-4 py-4"
                  >
                    {p.question && (
                      <>
                        <p className="font-semibold">
                          <MarkedText
                            block={`wtq:${p.number}`}
                            text={`${p.number}. ${p.question}`}
                          />
                          <Link
                            href={paragraphHref(year, week, i + 1)}
                            aria-label={`Absatz ${p.number}: Antwortvarianten und Notiz`}
                            className="ml-1 inline-flex align-middle text-brand-mid"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </p>
                        <AnswerBox
                          target={target}
                          index={0}
                          initial={f?.text ?? ""}
                          origin={f?.origin ?? null}
                        />
                      </>
                    )}
                    <p className="reading-sm text-muted-foreground">
                      <span className="mr-1.5 font-semibold text-foreground">
                        {p.number}
                      </span>
                      <MarkedText
                        block={`wt:${p.number}`}
                        text={p.originalText}
                      />
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!workbook && !article && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <PencilLine className="mx-auto mb-2 size-6" />
            Für diese Woche sind noch keine Inhalte vorhanden. Lade sie oben von
            wol.jw.org.
          </div>
        )}
      </div>
    </HighlightScope>
  );
}

/** Stoff des Versammlungsbibelstudiums: Frage → Antwortfeld → Absatz (wie beim Wachtturm). */
function MaterialBlock({
  item,
  weekId,
  fields,
}: {
  item: WorkbookItem;
  weekId: string;
  fields: AnswerField[];
}) {
  const m = item.material!;
  const target = {
    weekId,
    targetType: "workbook_item" as const,
    targetId: item.id,
  };
  // Antwortfelder zählen nach den eigenen Fragen des Programmpunkts weiter
  const indices = m.paragraphs.reduce<number[]>((acc, p) => {
    const next = item.questions.length + acc.filter((x) => x >= 0).length;
    return [...acc, p.question.trim() ? next : -1];
  }, []);
  const box = (i: number) => {
    const f = fieldOf(fields, "workbook_item", item.id, i);
    return (
      <AnswerBox
        target={target}
        index={i}
        initial={f?.text ?? ""}
        origin={f?.origin ?? null}
      />
    );
  };
  return (
    <div className="mt-3 rounded-xl border bg-surface px-3 py-3 sm:px-4">
      <a
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-mid hover:underline"
      >
        {m.title} <ExternalLink className="size-3.5" />
      </a>
      <div className="mt-1 divide-y">
        {m.paragraphs.map((p, j) => {
          const key = p.number || String(j + 1);
          const index = indices[j];
          return (
            <div key={j} className="py-3">
              {index >= 0 && (
                <>
                  <p className="font-semibold">
                    <MarkedText
                      block={`cbsq:${item.position}:${key}`}
                      text={p.question}
                    />
                  </p>
                  {box(index)}
                </>
              )}
              {p.text && (
                <p className="reading-sm text-muted-foreground">
                  {p.number && (
                    <span className="mr-1.5 font-semibold text-foreground">
                      {p.number}
                    </span>
                  )}
                  <MarkedText
                    block={`cbs:${item.position}:${key}`}
                    text={p.text}
                  />
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
