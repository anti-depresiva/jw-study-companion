"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";
import type { StoredImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Zeigt ein lokal gespeichertes Bild (Blob) an und gibt den Speicher beim Entfernen frei. */
function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    // Objekt-URL ist eine externe Ressource, die hier erzeugt und beim Aufräumen freigegeben wird.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function ImageThumb({ blob, alt, onClick, className }: { blob: Blob; alt: string; onClick?: () => void; className?: string }) {
  const url = useObjectUrl(blob);
  const img = url ? (
    // eslint-disable-next-line @next/next/no-img-element -- lokales Blob-Bild
    <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
  ) : null;
  const cls = cn("aspect-[4/3] overflow-hidden rounded-lg border bg-muted", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition-opacity hover:opacity-90")} aria-label={`${alt} vergrößern`}>
      {img}
    </button>
  ) : (
    <div className={cls}>{img}</div>
  );
}

function Lightbox({ images, index, onClose, onIndex }: { images: StoredImage[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const url = useObjectUrl(images[index]?.blob ?? null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(images.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, images.length, onClose, onIndex]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Bildansicht">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2 text-sm text-white/80">
        <span>
          Bild {index + 1} von {images.length}
        </span>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Schließen">
          <X className="size-6 text-white" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={onClose}>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- lokales Blob-Bild
          <img src={url} alt={`Bild ${index + 1}`} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        )}
        {index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index - 1);
            }}
            className="absolute left-2 rounded-full bg-white/10 p-2.5 hover:bg-white/20"
            aria-label="Vorheriges Bild"
          >
            <ChevronLeft className="size-6 text-white" />
          </button>
        )}
        {index < images.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index + 1);
            }}
            className="absolute right-2 rounded-full bg-white/10 p-2.5 hover:bg-white/20"
            aria-label="Nächstes Bild"
          >
            <ChevronRight className="size-6 text-white" />
          </button>
        )}
      </div>
      <div className="pb-[max(env(safe-area-inset-bottom),12px)]" />
    </div>
  );
}

/** „Bilder dieser Woche“ aus der importierten PDF – nur auf dem Gerät gespeichert. */
export function WeekImages({ weekId, kind, className }: { weekId: string; kind: StoredImage["kind"]; className?: string }) {
  const { data: images } = useData(() => store.listImages(weekId, kind), [weekId, kind]);
  const [open, setOpen] = useState<number | null>(null);
  if (!images?.length) return null;
  return (
    <section className={className} aria-label="Bilder dieser Woche">
      <h2 className="eyebrow mb-2 flex items-center gap-1.5 text-muted-foreground">
        <ImageIcon className="size-3.5" /> Bilder dieser Woche ({images.length})
      </h2>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <ImageThumb key={img.id} blob={img.blob} alt={`Bild ${i + 1}`} onClick={() => setOpen(i)} className="w-36 shrink-0 snap-start sm:w-44" />
        ))}
      </div>
      {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </section>
  );
}
