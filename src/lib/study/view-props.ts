import type { StudyViewProps } from "@/components/study/study-view";
import { importHref } from "@/lib/routes";
import { bibleLookupUrl } from "@/lib/sources/links";
import { findScriptures } from "@/lib/scripture";
import type { Favorite } from "@/lib/types";
import { SECTION_TITLES } from "@/lib/types";
import type { WeekData } from "./load";
import { assertSourceReady, buildSourceRef, type ResolvedTarget } from "./targets";

type Nav = Pick<StudyViewProps, "prev" | "next" | "position" | "backHref" | "backLabel">;

export function buildStudyViewProps(t: ResolvedTarget, data: WeekData, favorites: Favorite[], aiReady: boolean, nav: Nav): StudyViewProps {
  const targetId = t.type === "paragraph" ? t.paragraph.id : t.item.id;
  const answer = data.answers.find((a) => a.targetType === t.type && a.targetId === targetId) ?? null;
  const note = data.notes.find((n) => n.targetType === t.type && n.targetId === targetId)?.text ?? "";
  const prepared = data.progress.some((p) => p.targetType === t.type && p.targetId === targetId && p.prepared);
  const scriptureText = t.type === "paragraph" ? `${t.paragraph.originalText}\n${t.paragraph.question}` : `${t.item.title}\n${t.item.originalText}`;
  const refs = findScriptures(scriptureText);
  let sourceReady = true;
  try {
    assertSourceReady(t);
  } catch {
    sourceReady = false;
  }

  return {
    targetType: t.type,
    weekId: t.week.id,
    targetId,
    eyebrow: t.type === "paragraph" ? "Wachtturm-Studium" : `Arbeitsheft · ${SECTION_TITLES[t.item.section]}`,
    title: t.type === "paragraph" ? `Absatz ${t.paragraph.number}` : t.item.title,
    subtitle: t.type === "paragraph" ? t.article.title : (t.item.duration ?? undefined),
    questions: t.type === "paragraph" ? (t.paragraph.question ? [t.paragraph.question] : []) : t.item.questions,
    questionLabel: t.type === "paragraph" ? "Originalfrage" : "Fragen aus dem Arbeitsheft",
    originalText: t.originalText,
    scriptureLinks: refs.map((r) => ({ label: r.label, url: bibleLookupUrl(r.label) })),
    answer,
    sourceRef: buildSourceRef(t, refs.map((r) => r.label)),
    sourceReady,
    note,
    prepared,
    defaultVariant: data.settings.defaultVariant,
    favoriteTexts: favorites.filter((f) => f.targetId === targetId).map((f) => ({ id: f.id, text: f.text })),
    favLabel: t.type === "paragraph" ? `Wachtturm · Absatz ${t.paragraph.number}` : `Arbeitsheft · ${t.item.title}`,
    aiEnabled: aiReady,
    importHref: importHref(t.week.year, t.week.week, t.type === "paragraph" ? "watchtower" : "workbook"),
    ...nav,
  };
}
