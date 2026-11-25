import { referenceSpans } from "@/lib/references";
import { scriptureSpans } from "@/lib/scripture";
import { bibleLookupUrl } from "@/lib/sources/links";

/** Text mit blau verlinkten Bibelstellen und Verweisen – wie in der Online-Bibliothek. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const spans = [
    ...scriptureSpans(text).map((s) => ({ ...s, href: bibleLookupUrl(s.ref.label), italic: false })),
    ...referenceSpans(text).map((s) => ({ ...s, href: s.ref.url, italic: true })),
  ]
    .sort((a, b) => a.start - b.start)
    .filter((s, i, all) => i === 0 || s.start >= all[i - 1].end);

  const parts: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach((s, i) => {
    if (s.start > pos) parts.push(text.slice(pos, s.start));
    parts.push(
      <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className={s.italic ? "text-brand-mid italic hover:underline" : "text-brand-mid hover:underline"}>
        {text.slice(s.start, s.end)}
      </a>,
    );
    pos = s.end;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  return <span className={className}>{parts}</span>;
}
