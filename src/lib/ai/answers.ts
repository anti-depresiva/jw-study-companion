import { z } from "zod";
import type { Store } from "@/lib/data/store";
import { scriptureLabels } from "@/lib/scripture";
import { assertSourceReady, buildSourceRef, NO_SOURCE_MESSAGE, type ResolvedTarget } from "@/lib/study/targets";
import type { AnswerSet, CommentKind, ExtraComment, Settings } from "@/lib/types";
import { model, structured } from "./client";
import { allowedRefs, checkGrounding, filterScriptureList } from "./grounding";
import { articleContext, commentsTask, paragraphTask, SYSTEM_PROMPT, translationNote, workbookContext, workbookTask } from "./prompts";

const AnswerSchema = z.strictObject({
  grounded: z.boolean(),
  missing: z.string(),
  short: z.string(),
  detailed: z.string(),
  personal: z.string(),
  extra_thought: z.string(),
  scriptures: z.array(z.string()),
});

const CommentsSchema = z.strictObject({
  comments: z.array(
    z.strictObject({
      kind: z.enum(["blickwinkel", "bibelstelle", "alltag", "erkenntnis", "natuerlich"]),
      text: z.string(),
      scriptures: z.array(z.string()),
    }),
  ),
});

function contextFor(t: ResolvedTarget) {
  return t.type === "paragraph" ? articleContext(t.article) : workbookContext(t.workbook);
}

function allowedFor(t: ResolvedTarget) {
  return t.type === "paragraph"
    ? allowedRefs(t.paragraph.originalText, t.paragraph.question, t.article.themeScripture)
    : allowedRefs(t.item.originalText, t.item.title, t.workbook.bibleReading);
}

const correction = (invented: string[]) => ({
  role: "user" as const,
  content: `Korrektur nötig: Diese Bibelstellen kommen im Studienmaterial nicht vor: ${invented.join(", ")}. Entferne sie und verwende nur Stellen aus der erlaubten Liste. Gib das vollständige JSON erneut aus.`,
});

/** Erzeugt die drei Antwortvarianten für einen Absatz bzw. Programmpunkt und speichert sie. */
export async function generateAnswerSet(store: Store, t: ResolvedTarget, settings: Settings): Promise<AnswerSet> {
  assertSourceReady(t);
  const allowed = allowedFor(t);
  const allowedLabels = allowed.map((a) => a.label);
  const prompt = t.type === "paragraph" ? paragraphTask(t.paragraph, settings, allowedLabels) : workbookTask(t.item, settings, allowedLabels);

  const base = {
    system: SYSTEM_PROMPT,
    context: contextFor(t),
    prompt,
    schema: AnswerSchema,
    maxTokens: 8000,
  };
  let out = await structured(base);
  let check = checkGrounding([out.short, out.detailed, out.personal, out.extra_thought], allowed);
  if (!check.ok) {
    // Ein Korrekturdurchgang mit konkretem Hinweis
    out = await structured({
      ...base,
      followUps: [{ role: "assistant", content: JSON.stringify(out) }, correction(check.invented)],
    });
    check = checkGrounding([out.short, out.detailed, out.personal, out.extra_thought], allowed);
  }

  const warnings: string[] = [];
  if (!out.grounded) warnings.push(`${NO_SOURCE_MESSAGE} ${out.missing}`.trim());
  if (!check.ok) warnings.push(`Nicht im Originaltext belegte Bibelstelle(n): ${check.invented.join(", ")} – bitte prüfen.`);

  const scriptures = filterScriptureList([...out.scriptures, ...scriptureLabels(`${out.short}\n${out.detailed}\n${out.personal}`)], allowed);
  const previous = await store.getAnswer(t.type, t.type === "paragraph" ? t.paragraph.id : t.item.id);

  return store.saveAnswer({
    targetType: t.type,
    targetId: t.type === "paragraph" ? t.paragraph.id : t.item.id,
    weekId: t.week.id,
    short: out.short.trim(),
    detailed: out.detailed.trim(),
    personal: out.personal.trim(),
    extraThought: out.extra_thought.trim(),
    scriptures,
    sourceRef: buildSourceRef(t, scriptures),
    warnings,
    extraComments: previous?.extraComments ?? [],
    model: model(),
    generatedAt: new Date().toISOString(),
  });
}

/** Kommentar-Generator: fünf weitere Perspektiven, an die bestehenden Antworten angehängt. */
export async function generateComments(store: Store, t: ResolvedTarget, settings: Settings): Promise<AnswerSet> {
  assertSourceReady(t);
  const targetId = t.type === "paragraph" ? t.paragraph.id : t.item.id;
  const existing = await store.getAnswer(t.type, targetId);
  if (!existing) throw new Error("Bitte zuerst die drei Antwortvarianten erzeugen.");
  const allowed = allowedFor(t);
  const prior = [existing.short, existing.detailed, existing.personal, ...existing.extraComments.map((c) => c.text)];

  const out = await structured({
    system: SYSTEM_PROMPT,
    context: contextFor(t),
    prompt: commentsTask(
      t.label,
      t.question,
      settings,
      allowed.map((a) => a.label),
      prior,
    ),
    schema: CommentsSchema,
    maxTokens: 8000,
  });

  const warnings = new Set(existing.warnings);
  const comments: ExtraComment[] = out.comments.map((c) => {
    const g = checkGrounding([c.text], allowed);
    if (!g.ok) warnings.add(`Kommentar „${c.text.slice(0, 40)}…“ nennt nicht belegte Stelle(n): ${g.invented.join(", ")}.`);
    return {
      id: crypto.randomUUID(),
      kind: c.kind as CommentKind,
      text: c.text.trim(),
      scriptures: filterScriptureList([...c.scriptures, ...scriptureLabels(c.text)], allowed),
      createdAt: new Date().toISOString(),
    };
  });

  return store.saveAnswer({
    ...existing,
    extraComments: [...existing.extraComments, ...comments],
    warnings: [...warnings],
  });
}

const FieldsSchema = z.strictObject({
  answers: z.array(
    z.strictObject({
      index: z.number().int(),
      grounded: z.boolean(),
      answer: z.string(),
    }),
  ),
});

/** Originaltext einer verlinkten Stelle (Veröffentlichung oder Bibeltext) von jw.org. */
export interface ReferenceText {
  label: string;
  url: string;
  text: string;
}

/**
 * Füllt die Antwortfelder eines Programmpunkts: je Frage eine kurze, natürliche Antwort.
 * Grundlage sind das Studienmaterial und die verlinkten Verweise (von jw.org abgerufen).
 * Persönliche Fragen werden in der Ich-Form als Vorschlag beantwortet.
 */
export async function generateFieldAnswers(
  t: ResolvedTarget,
  settings: Settings,
  refs: ReferenceText[] = [],
): Promise<{ answers: string[]; warnings: string[] }> {
  assertSourceReady(t);
  if (t.type !== "workbook_item" || t.item.questions.length === 0) return { answers: [], warnings: [] };
  const allowed = allowedRefs(t.item.originalText, t.item.title, t.workbook.bibleReading, ...refs.map((r) => r.text));
  const length = settings.commentLength === "kurz" ? "15–30" : settings.commentLength === "lang" ? "35–60" : "25–45";
  const refContext = refs.length
    ? `\n\nVERWEISE (Originaltext der im Programmpunkt verlinkten Stellen von jw.org):\n${refs
        .map((r) => `<verweis titel="${r.label.replace(/"/g, "'")}" url="${r.url}">\n${r.text}\n</verweis>`)
        .join("\n")}`
    : "";
  const out = await structured({
    system: SYSTEM_PROMPT,
    context: contextFor(t) + refContext,
    prompt: `Aufgabe: Beantworte für den Programmpunkt ${t.item.position} „${t.item.title}“ jede der folgenden Fragen einzeln – so, wie man sie bei der Zusammenkunft kurz kommentieren würde (${length} Wörter, natürlich formuliert).
${t.item.questions.map((q, i) => `${i}: ${q}`).join("\n")}

Regeln:
- Grundlage sind das Studienmaterial (Programmpunkt und ggf. „Studienmaterial“ mit Kapiteltext) und die VERWEISE. Verweist eine Frage auf eine Stelle (z. B. „it ‚Jephtha‘ Abs. 6“, „th Lektion 2“), nutze vor allem den Text dieses Verweises.
- Anwendungsfragen („Wie können wir …?“, „Was lerne ich daraus über Jehova?“) beantwortest du mit Gedanken aus dem Material.
- Persönliche Fragen („Was hast du beim Bibellesen entdeckt?“, „Was möchte ich … fragen?“) beantwortest du persönlich in der Ich-Form – als natürlicher, ehrlicher Vorschlag, gestützt auf den Bibeltext bzw. das Material (keine erfundenen Erlebnisse, Namen oder Orte). grounded = true.
- grounded = false und answer = "" nur, wenn das Material wirklich nichts dazu hergibt.
- Nenne nur Bibelstellen aus dieser Liste: ${allowed.map((a) => a.label).join("; ") || "keine"}.${translationNote(settings)}`,
    schema: FieldsSchema,
    // Viele Fragen (z. B. Versammlungsbibelstudium mit 10+ Fragen) plus Nachdenken brauchen Platz
    maxTokens: 32000,
  });
  const answers = t.item.questions.map((_, i) => {
    const a = out.answers.find((x) => x.index === i);
    return a && a.grounded ? a.answer.trim() : "";
  });
  const check = checkGrounding(answers, allowed);
  const warnings = check.ok ? [] : [`Nicht im Originaltext belegte Bibelstelle(n): ${check.invented.join(", ")} – bitte prüfen.`];
  return { answers, warnings };
}
