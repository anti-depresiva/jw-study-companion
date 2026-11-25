"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { saveFieldText, type Target } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Graues Antwortfeld unter einer Frage – wie in der Online-Bibliothek.
 * Vorbelegt mit der KI-Antwort, frei bearbeitbar; wird automatisch gespeichert.
 */
export function AnswerBox({ target, index, initial, origin }: { target: Target; index: number; initial: string; origin: "ai" | "user" | null }) {
  const [text, setText] = useState(initial);
  const [source, setSource] = useState(origin);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const last = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Neue KI-Antwort von außen übernehmen, solange nicht gerade getippt wird
  useEffect(() => {
    if (initial !== last.current && document.activeElement !== ref.current) {
      last.current = initial;
      setText(initial);
      setSource(origin);
    }
  }, [initial, origin]);

  // Höhe an den Inhalt anpassen (leeres Feld: feste Höhe wie in der Online-Bibliothek)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.style.height = "56px";
      if (text.trim()) el.style.height = `${Math.max(56, el.scrollHeight + 2)}px`;
    });
    return () => cancelAnimationFrame(frame);
  }, [text]);

  const save = async (value: string) => {
    if (value === last.current) return;
    setState("saving");
    try {
      await saveFieldText(target, index, value);
      last.current = value;
      setSource(value.trim() ? "user" : null);
      setState("saved");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="my-2.5">
      <textarea
        ref={ref}
        value={text}
        rows={2}
        placeholder="Eigene Antwort …"
        aria-label="Antwortfeld"
        className={cn(
          "reading-sm block w-full resize-none rounded-md border border-transparent bg-[#d7d7d7] px-3 py-2.5 text-[#1a1a1a] placeholder:text-[#6b6b6b]",
          "focus:border-brand-mid focus:outline-none dark:bg-[#3a3d42] dark:text-[#ececec] dark:placeholder:text-[#9a9a9a]",
        )}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => save(v), 900);
        }}
        onBlur={() => save(text)}
      />
      <div className="mt-0.5 flex h-4 items-center justify-end gap-1 text-[0.7rem] text-muted-foreground" aria-live="polite">
        {state === "saving" ? "Speichert …" : state === "error" ? "Speichern fehlgeschlagen" : source === "ai" ? (
          <>
            <Sparkles className="size-3" /> KI-Vorschlag – frei bearbeitbar
          </>
        ) : state === "saved" ? "Gespeichert" : null}
      </div>
    </div>
  );
}
