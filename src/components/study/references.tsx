"use client";

import { useState } from "react";
import { ExternalLink, Library, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/ai/client";
import * as actions from "@/lib/actions";
import type { Reference } from "@/lib/references";
import type { Lookup, TargetType } from "@/lib/types";
import { ContentLabel } from "./labels";

type Target = { weekId: string; targetType: TargetType; targetId: string };

/**
 * Verweise auf andere Veröffentlichungen (z. B. „w24.01 30 Abs. 16“):
 *  - Link zur Online-Bibliothek von jw.org (selbst lesen, kostenlos)
 *  - „Claude schlägt nach“: Zusammenfassung ausschließlich aus jw.org, mit Quelle
 */
export function References({ target, references, lookups, aiEnabled }: { target: Target; references: Reference[]; lookups: Lookup[]; aiEnabled: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<Record<string, string>>({});
  if (references.length === 0 && lookups.length === 0) return null;

  async function lookup(ref: Reference) {
    setBusy(ref.text);
    try {
      const res = await actions.lookupReference(target, ref.text);
      if (res.message) setNotFound((n) => ({ ...n, [ref.text]: res.message! }));
      else toast.success("Nachgeschlagen und gespeichert.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6 rounded-xl border bg-card p-4" aria-label="Verweise und Zusatzmaterial">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Library className="size-4 text-brand-mid" /> Verweise &amp; Zusatzmaterial
      </h2>
      <ul className="space-y-3">
        {references.map((ref) => {
          const results = lookups.filter((l) => l.reference === ref.text);
          return (
            <li key={ref.text} className="rounded-lg border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{ref.text}</span>
                {ref.description !== ref.text && <span className="text-xs text-muted-foreground">{ref.description}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                >
                  In der Online-Bibliothek öffnen <ExternalLink className="size-3.5" />
                </a>
                {aiEnabled && (
                  <Button variant="outline" className="h-8 px-3" disabled={busy !== null} onClick={() => lookup(ref)}>
                    {busy === ref.text ? <Loader2 className="animate-spin" /> : <Search />}
                    {busy === ref.text ? "Claude sucht auf jw.org …" : results.length ? "Erneut nachschlagen" : "Claude schlägt nach"}
                  </Button>
                )}
              </div>
              {notFound[ref.text] && <p className="mt-2 text-sm text-muted-foreground">{notFound[ref.text]}</p>}
              {results.map((l) => (
                <LookupResult key={l.id} lookup={l} />
              ))}
            </li>
          );
        })}
        {/* Ergebnisse zu Verweisen, die nach einem Neuimport nicht mehr im Text stehen */}
        {lookups
          .filter((l) => !references.some((r) => r.text === l.reference))
          .map((l) => (
            <li key={l.id} className="rounded-lg border bg-surface p-3">
              <span className="font-mono text-sm font-semibold">{l.reference}</span>
              <LookupResult lookup={l} />
            </li>
          ))}
      </ul>
      {!aiEnabled && references.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Mit API-Schlüssel kann Claude die Verweise auf jw.org nachschlagen.</p>
      )}
    </section>
  );
}

function LookupResult({ lookup }: { lookup: Lookup }) {
  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <ContentLabel kind="ai">KI-Zusammenfassung aus jw.org</ContentLabel>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zusammenfassung löschen"
          onClick={() => actions.deleteLookup(lookup.id).catch((e) => toast.error(friendlyError(e)))}
        >
          <Trash2 />
        </Button>
      </div>
      <p className="reading-sm whitespace-pre-line">{lookup.text}</p>
      {lookup.sources.length > 0 && (
        <div className="mt-2">
          <ContentLabel kind="source">Offizielle Quellen</ContentLabel>
          <ul className="mt-1 space-y-0.5 text-sm">
            {lookup.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-mid hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {lookup.warnings.map((w) => (
        <p key={w} className="mt-1 text-xs text-muted-foreground">
          {w}
        </p>
      ))}
      <p className="mt-1 text-xs text-muted-foreground">Bitte mit der Originalstelle vergleichen.</p>
    </div>
  );
}
