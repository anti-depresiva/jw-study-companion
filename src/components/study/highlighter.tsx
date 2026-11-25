"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Highlighter as HighlighterIcon, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import * as actions from "@/lib/actions";
import type { Highlight, HighlightColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MARK_CLASS, RichText, type Mark } from "./rich-text";

const COLORS: Array<{ color: HighlightColor; label: string }> = [
  { color: "yellow", label: "Gelb" },
  { color: "green", label: "Grün" },
  { color: "blue", label: "Blau" },
  { color: "pink", label: "Rosa" },
  { color: "purple", label: "Lila" },
  { color: "orange", label: "Orange" },
];

const Ctx = createContext<{ weekId: string; highlights: Highlight[] } | null>(null);

/** Markierungen eines Blocks; verschobener Text wird über den gespeicherten Wortlaut wiedergefunden. */
function marksFor(highlights: Highlight[], block: string, text: string): Mark[] {
  return highlights.flatMap((h) => {
    if (h.block !== block) return [];
    if (text.slice(h.start, h.end) === h.text) return [h];
    const at = text.indexOf(h.text);
    return at >= 0 ? [{ ...h, start: at, end: at + h.text.length }] : [];
  });
}

/** Markierbarer Text (Block-Schlüssel muss beim Neuladen der Woche gleich bleiben). */
export function MarkedText({ block, text, className }: { block: string; text: string; className?: string }) {
  const ctx = useContext(Ctx);
  return <RichText text={text} className={className} block={block} marks={ctx ? marksFor(ctx.highlights, block, text) : []} />;
}

interface Pending {
  block: string;
  start: number;
  end: number;
  text: string;
}

/** Zeichenposition innerhalb eines Blocks */
function offsetIn(blockEl: Element, node: Node, offset: number) {
  const r = document.createRange();
  r.selectNodeContents(blockEl);
  r.setEnd(node, offset);
  return r.toString().length;
}

function readSelection(): Pending | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const startEl = (range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement)?.closest("[data-block]");
  if (!startEl) return null;
  const endEl = (range.endContainer instanceof Element ? range.endContainer : range.endContainer.parentElement)?.closest("[data-block]");
  const start = offsetIn(startEl, range.startContainer, range.startOffset);
  // Auswahl über mehrere Absätze: bis zum Ende des ersten Absatzes markieren
  const full = startEl.textContent ?? "";
  const end = endEl === startEl ? offsetIn(startEl, range.endContainer, range.endOffset) : full.length;
  let a = start;
  let b = end;
  while (a < b && /\s/.test(full[a])) a++;
  while (b > a && /\s/.test(full[b - 1])) b--;
  if (b <= a) return null;
  return { block: startEl.getAttribute("data-block")!, start: a, end: b, text: full.slice(a, b) };
}

/**
 * Textmarker wie in JW Library: Text auswählen → Farbe antippen.
 * Antippen einer Markierung → Farbe ändern oder entfernen. Alles bleibt auf dem Gerät.
 */
export function HighlightScope({ weekId, highlights, children }: { weekId: string; highlights: Highlight[]; children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [active, setActive] = useState<Highlight | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onChange = () => {
      const p = readSelection();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (p) {
        setPending(p);
        setActive(null);
      } else {
        // Beim Antippen der Farbleiste hebt iOS die Auswahl auf – kurz warten
        hideTimer.current = setTimeout(() => setPending(null), 600);
      }
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  const onClick = (e: React.MouseEvent) => {
    const el = (e.target as Element).closest("mark[data-hl]");
    if (!el) {
      setActive(null);
      return;
    }
    if (window.getSelection()?.toString()) return;
    const h = highlights.find((x) => x.id === el.getAttribute("data-hl"));
    if (h) {
      e.preventDefault();
      setActive(h);
      setPending(null);
    }
  };

  const keep = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  async function apply(color: HighlightColor) {
    try {
      if (active) {
        await actions.recolorHighlight(active.id, color);
        setActive(null);
      } else if (pending) {
        await actions.addHighlight({ weekId, ...pending, color });
        window.getSelection()?.removeAllRanges();
        setPending(null);
      }
    } catch {
      toast.error("Markierung konnte nicht gespeichert werden.");
    }
  }

  async function remove() {
    if (!active) return;
    await actions.removeHighlight(active.id);
    setActive(null);
  }

  const open = Boolean(pending || active);

  return (
    <Ctx.Provider value={{ weekId, highlights }}>
      <div onClick={onClick}>{children}</div>
      <div
        role="toolbar"
        aria-label="Textmarker"
        aria-hidden={!open}
        onPointerDown={keep}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit items-center gap-1.5 rounded-full border bg-popover px-2.5 py-2 shadow-xl transition-all duration-150 lg:bottom-6",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <HighlighterIcon className="mx-1 size-4 text-muted-foreground" aria-hidden />
        {COLORS.map(({ color, label }) => (
          <button
            key={color}
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label={`${active ? "Farbe ändern" : "Markieren"}: ${label}`}
            onClick={() => apply(color)}
            className={cn("size-8 rounded-full border border-black/10", MARK_CLASS[color], active?.color === color && "ring-2 ring-brand-mid ring-offset-1")}
          />
        ))}
        {active ? (
          <button type="button" tabIndex={open ? 0 : -1} aria-label="Markierung entfernen" onClick={remove} className="ml-1 flex size-8 items-center justify-center rounded-full text-destructive hover:bg-muted">
            <Trash2 className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label="Schließen"
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              setPending(null);
            }}
            className="ml-1 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}
