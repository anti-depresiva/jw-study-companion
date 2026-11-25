"use client";

import { friendlyError } from "@/lib/ai/client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { prepareWeek } from "@/lib/actions";
import { store } from "@/lib/data";
import { importHref, weekHref } from "@/lib/routes";
import { isPreparing } from "@/lib/study/prepare";
import type { PrepJob } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  year: number;
  week: number;
  label?: string;
  notify?: boolean;
  initialJob?: PrepJob | null;
  weekId?: string | null;
  className?: string;
}

/** „JETZT DIESE WOCHE VORBEREITEN“ – läuft direkt auf dem Gerät. */
export function PrepareButton({ year, week, label = "Jetzt diese Woche vorbereiten", notify, initialJob, weekId, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<PrepJob | null>(null);
  const [result, setResult] = useState<{ notes: string[]; hasContent: boolean } | null>(null);
  // Ein gespeicherter „laufender“ Job ohne aktive Ausführung wurde durch Schließen der App unterbrochen.
  const interrupted = !busy && initialJob?.state === "running" && Boolean(weekId) && !isPreparing(weekId!);

  async function start() {
    setBusy(true);
    setResult(null);
    setJob(null);
    try {
      const res = await prepareWeek({
        year,
        week,
        onProgress: (id) => void store.getWeekById(id).then((w) => setJob(w?.prepJob ?? null)),
      });
      setResult({ notes: res.notes, hasContent: res.hasContent });
      if (res.run) {
        await res.run;
        const w = await store.getWeekById(res.week.id);
        setJob(w?.prepJob ?? null);
        if (w?.prepJob?.state === "done") {
          toast.success(w.prepJob.message);
          if (notify && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("JW+ Study", { body: `KW ${week}: ${w.prepJob.message}` });
            } catch {
              /* iOS erlaubt lokale Benachrichtigungen nur eingeschränkt */
            }
          }
        } else if (w?.prepJob?.state === "error") toast.error(w.prepJob.message);
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const running = busy && job?.state === "running";
  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <div className={cn("w-full", className)}>
      <Button onClick={start} disabled={busy} size="lg" className="h-12 w-full rounded-xl text-[0.92rem] font-semibold tracking-wide uppercase shadow-sm">
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {running ? "Vorbereitung läuft …" : busy ? "Quellen werden geprüft …" : interrupted ? "Vorbereitung fortsetzen" : label}
      </Button>

      {running && (
        <div className="mt-3 space-y-1.5" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{job?.message}</p>
        </div>
      )}
      {interrupted && (
        <p className="mt-2 text-xs text-muted-foreground">Die letzte Vorbereitung wurde unterbrochen (App geschlossen). Bereits erstellte Antworten bleiben erhalten.</p>
      )}

      {result && !result.hasContent && (
        <div className="fade-in mt-4 rounded-xl border bg-gold-soft/60 p-4 text-sm">
          <p className="flex items-start gap-2 font-medium">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            Woche angelegt und offizielle Quellen vermerkt.
          </p>
          <p className="mt-1.5 text-muted-foreground">
            Lade die Woche auf der Seite „Zusammenkünfte“ mit „Woche von wol.jw.org laden“ – oder füge den Text aus der Online-Bibliothek ein.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink size="sm" variant="outline" href={importHref(year, week, "workbook")}>
              <Upload /> Arbeitsheft importieren
            </ButtonLink>
            <ButtonLink size="sm" variant="outline" href={importHref(year, week, "watchtower")}>
              <Upload /> Wachtturm importieren
            </ButtonLink>
            <ButtonLink size="sm" variant="ghost" href={`${weekHref("/zusammenkuenfte", year, week)}#quellen`}>
              Quellen ansehen
            </ButtonLink>
          </div>
        </div>
      )}

      {result?.notes && result.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {result.notes.map((n) => (
            <li key={n} className="flex gap-1.5">
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
