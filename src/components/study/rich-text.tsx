import { referenceSpans } from "@/lib/references";
import { scriptureSpans } from "@/lib/scripture";
import { bibleLookupUrl } from "@/lib/sources/links";
import type { HighlightColor } from "@/lib/types";

export interface Mark {
  id: string;
  start: number;
  end: number;
  color: HighlightColor;
}

/** Textmarker-Farben wie in JW Library (hell und dunkel gut lesbar). */
export const MARK_CLASS: Record<HighlightColor, string> = {
  yellow: "bg-[#ffe45c]/80 dark:bg-[#b08d00]/70",
  green: "bg-[#a6e3a1]/80 dark:bg-[#2f7d32]/70",
  blue: "bg-[#9fd3ff]/80 dark:bg-[#1f5f99]/70",
  pink: "bg-[#ffb3d1]/80 dark:bg-[#a33b6b]/70",
  purple: "bg-[#d4b8ff]/80 dark:bg-[#6a43a8]/70",
  orange: "bg-[#ffc48a]/80 dark:bg-[#b0601a]/70",
};

/**
 * Text mit blau verlinkten Bibelstellen und Verweisen – wie in der Online-Bibliothek –
 * und optional Textmarker-Markierungen. Der ausgegebene Text entspricht exakt `text`,
 * damit Markierungen über Zeichenpositionen gespeichert werden können.
 */
export function RichText({ text, className, marks = [], block }: { text: string; className?: string; marks?: Mark[]; block?: string }) {
  const links = [
    ...scriptureSpans(text).map((s) => ({ ...s, href: bibleLookupUrl(s.ref.label), italic: false })),
    ...referenceSpans(text).map((s) => ({ ...s, href: s.ref.url, italic: true })),
  ]
    .sort((a, b) => a.start - b.start)
    .filter((s, i, all) => i === 0 || s.start >= all[i - 1].end);

  const cuts = new Set([0, text.length]);
  for (const s of [...links, ...marks]) {
    cuts.add(Math.max(0, Math.min(text.length, s.start)));
    cuts.add(Math.max(0, Math.min(text.length, s.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);

  const parts: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a === b) continue;
    let node: React.ReactNode = text.slice(a, b);
    const mark = marks.find((m) => m.start <= a && b <= m.end);
    if (mark) {
      node = (
        <mark data-hl={mark.id} className={`rounded-[2px] text-inherit ${MARK_CLASS[mark.color]}`}>
          {node}
        </mark>
      );
    }
    const link = links.find((l) => l.start <= a && b <= l.end);
    if (link) {
      node = (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className={link.italic ? "text-brand-mid italic hover:underline" : "text-brand-mid hover:underline"}>
          {node}
        </a>
      );
    }
    parts.push(<span key={a}>{node}</span>);
  }
  return (
    <span className={className} data-block={block}>
      {parts}
    </span>
  );
}
