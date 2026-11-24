"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeFavorite } from "@/lib/actions";
import type { Favorite } from "@/lib/types";

export function FavoriteList({ initial }: { initial: Favorite[] }) {
  const [items, setItems] = useState(initial);
  if (!items.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed bg-surface px-6 py-10 text-center">
        <Star className="mb-3 size-8 text-muted-foreground/70" />
        <p className="font-semibold">Noch keine Favoriten</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Tippe bei einer Antwort oder einem Kommentar auf den Stern, um ihn hier zu sammeln.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((f) => (
        <li key={f.id} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <Link href={f.href} className="eyebrow text-gold hover:underline">
              {f.label}
            </Link>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Kopieren"
                onClick={async () => {
                  await navigator.clipboard.writeText(f.text).catch(() => undefined);
                  toast.success("Kopiert.");
                }}
              >
                <Copy />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Favorit entfernen"
                onClick={async () => {
                  try {
                    await removeFavorite(f.id);
                    setItems((xs) => xs.filter((x) => x.id !== f.id));
                    toast("Favorit entfernt.");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          <p className="reading-sm">{f.text}</p>
          <p className="mt-2 text-xs text-muted-foreground">Gespeichert am {new Date(f.createdAt).toLocaleDateString("de-AT")}</p>
        </li>
      ))}
    </ul>
  );
}
