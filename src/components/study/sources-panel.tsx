"use client";

import { friendlyError } from "@/lib/ai/client";
import { useState } from "react";
import { Check, ExternalLink, Link2, Loader2, Plus, ShieldAlert, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as actions from "@/lib/actions";
import type { Source, SourceKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VERIFICATION_TEXT } from "./source-block";

const KIND_TEXT: Record<SourceKind, string> = { workbook: "Arbeitsheft", watchtower: "Wachtturm", bible: "Bibel", other: "Übersicht" };
const ORIGIN_TEXT: Record<Source["origin"], string> = { pattern: "Linkmuster", search: "jw.org-Suche", manual: "Manuell", pdf: "PDF-Import", text: "Text-Import" };

export function SourcesPanel({ weekId, sources }: { weekId: string; sources: Source[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", kind: "watchtower" as SourceKind });

  async function act(id: string, fn: () => Promise<unknown>, success: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(friendlyError(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="quellen" className="scroll-mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="eyebrow text-muted-foreground">Quellen dieser Woche</h2>
        <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)}>
          {adding ? <X /> : <Plus />} {adding ? "Abbrechen" : "jw.org-Link hinzufügen"}
        </Button>
      </div>

      {adding && (
        <form
          className="mb-3 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("new", () => actions.addSource({ weekId, ...form }), "Quelle verknüpft.")) {
              setAdding(false);
              setForm({ title: "", url: "", kind: "watchtower" });
            }
          }}
        >
          <Input required placeholder="Titel, z. B. Studienartikel 48" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={300} />
          <Input required type="url" inputMode="url" placeholder="https://www.jw.org/de/…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <select className="h-8 rounded-lg border bg-background px-2 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SourceKind })} aria-label="Art der Quelle">
            <option value="watchtower">Wachtturm</option>
            <option value="workbook">Arbeitsheft</option>
            <option value="bible">Bibel</option>
            <option value="other">Sonstiges</option>
          </select>
          <Button type="submit" disabled={busy === "new"}>
            {busy === "new" ? <Loader2 className="animate-spin" /> : <Link2 />} Speichern
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-4">Nur HTTPS-Adressen auf jw.org bzw. wol.jw.org werden akzeptiert.</p>
        </form>
      )}

      {sources.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Noch keine Quellen erkannt. Starte die Wochenvorbereitung.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {sources.map((s) => {
            const verified = !["unverified_pattern", "rejected"].includes(s.verification);
            return (
              <li key={s.id} className={cn("px-4 py-3", s.verification === "rejected" && "opacity-60")}>
                <div className="flex items-start gap-3">
                  {verified ? <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0 text-gold" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_TEXT[s.kind]} · {ORIGIN_TEXT[s.origin]} · {VERIFICATION_TEXT[s.verification]}
                      {s.publishedAt && ` · ${s.publishedAt}`}
                    </p>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-mid hover:underline">
                        <span className="truncate">{s.url}</span> <ExternalLink className="size-3 shrink-0" />
                      </a>
                    )}
                    {s.verification === "unverified_pattern" && (
                      <p className="mt-1 text-xs text-muted-foreground">Öffne den Link und bestätige ihn, wenn die richtige Woche angezeigt wird.</p>
                    )}
                  </div>
                </div>
                {s.verification !== "user_import" && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                    {s.verification !== "user_confirmed" && s.verification !== "rejected" && (
                      <Button size="xs" variant="outline" disabled={busy === s.id} onClick={() => act(s.id, () => actions.setSourceVerification(s.id, "user_confirmed"), "Quelle bestätigt.")}>
                        <Check /> Bestätigen
                      </Button>
                    )}
                    {s.verification !== "rejected" && (
                      <Button size="xs" variant="ghost" disabled={busy === s.id} onClick={() => act(s.id, () => actions.setSourceVerification(s.id, "rejected"), "Quelle verworfen.")}>
                        <X /> Verwerfen
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" disabled={busy === s.id} onClick={() => act(s.id, () => actions.deleteSource(s.id), "Quelle entfernt.")}>
                      <Trash2 /> Entfernen
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
