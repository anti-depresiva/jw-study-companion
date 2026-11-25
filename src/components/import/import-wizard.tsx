"use client";

import { friendlyError } from "@/lib/ai/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ClipboardPaste, Loader2, PenLine, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as actions from "@/lib/actions";
import { weekHref } from "@/lib/routes";
import type { WorkbookSection } from "@/lib/types";
import { SECTION_TITLES } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "watchtower" | "workbook";
type Mode = "text" | "manual";

interface ArticleDraft {
  title: string;
  studyNumber: string;
  issue: string;
  publishedAt: string;
  themeScripture: string;
  song: string;
  intro: string;
  paragraphs: Array<{ number: string; question: string; originalText: string }>;
}
interface WorkbookDraft {
  title: string;
  bibleReading: string;
  items: Array<{ section: WorkbookSection; title: string; duration: string; originalText: string; questions: string }>;
}

interface Props {
  kind: Kind;
  weekId: string;
  year: number;
  week: number;
  weekLabel: string;
  initialMode: Mode;
  hasExisting: boolean;
  suggestedUrls: Array<{ title: string; url: string }>;
  aiEnabled: boolean;
}

const emptyArticle = (): ArticleDraft => ({
  title: "",
  studyNumber: "",
  issue: "",
  publishedAt: "",
  themeScripture: "",
  song: "",
  intro: "",
  paragraphs: [{ number: "1", question: "", originalText: "" }],
});
const emptyWorkbook = (): WorkbookDraft => ({
  title: "",
  bibleReading: "",
  items: [{ section: "schaetze", title: "", duration: "", originalText: "", questions: "" }],
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function toArticleDraft(p: any): ArticleDraft {
  return {
    title: p.title ?? "",
    studyNumber: p.studyNumber ?? "",
    issue: "",
    publishedAt: "",
    themeScripture: p.themeScripture ?? "",
    song: p.song ?? "",
    intro: p.intro ?? "",
    paragraphs: (p.paragraphs ?? []).map((x: any) => ({ number: x.number, question: x.question ?? "", originalText: x.originalText })),
  };
}
function toWorkbookDraft(p: any): WorkbookDraft {
  return {
    title: p.title ?? "",
    bibleReading: p.bibleReading ?? "",
    items: (p.items ?? []).map((x: any) => ({
      section: x.section,
      title: x.title,
      duration: x.duration ?? "",
      originalText: x.originalText ?? "",
      questions: (x.questions ?? []).join("\n"),
    })),
  };
}

export function ImportWizard(props: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(props.initialMode);
  const [text, setText] = useState("");
  const [useAi, setUseAi] = useState<"auto" | "on" | "off">("auto");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<null | { method: string; origin: "text"; contentHash: string; duplicate: boolean; warnings: string[]; notes: string[]; chars: number }>(
    null,
  );
  const [article, setArticle] = useState<ArticleDraft | null>(props.initialMode === "manual" && props.kind === "watchtower" ? emptyArticle() : null);
  const [workbook, setWorkbook] = useState<WorkbookDraft | null>(props.initialMode === "manual" && props.kind === "workbook" ? emptyWorkbook() : null);
  const [sourceUrl, setSourceUrl] = useState(props.suggestedUrls[0]?.url ?? "");
  const [overwrite, setOverwrite] = useState(false);
  const [choices, setChoices] = useState<Array<{ number: string; title: string; weekLabel: string | null }>>([]);
  const [chosen, setChosen] = useState("");

  const isWt = props.kind === "watchtower";
  const draftReady = isWt ? article !== null : workbook !== null;

  function switchMode(m: Mode) {
    setMode(m);
    setPreview(null);
    if (m === "manual") {
      if (isWt) setArticle(emptyArticle());
      else setWorkbook(emptyWorkbook());
    } else {
      setArticle(null);
      setWorkbook(null);
    }
  }

  async function analyze(articleNumber?: string) {
    setLoading(true);
    try {
      const res: any = await actions.previewImport({
        kind: props.kind,
        weekId: props.weekId,
        ai: useAi,
        text,
        article: articleNumber,
      });
      setChoices(res.articleChoices ?? []);
      setPreview({
        method: res.method,
        origin: res.origin,
        contentHash: res.contentHash,
        duplicate: res.duplicate,
        warnings: res.parsed.warnings ?? [],
        notes: res.notes ?? [],
        chars: res.chars,
      });
      if (isWt) setArticle(toArticleDraft(res.parsed));
      else setWorkbook(toWorkbookDraft(res.parsed));
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const data = isWt
        ? { ...article!, paragraphs: article!.paragraphs.filter((p) => p.originalText.trim()) }
        : {
            ...workbook!,
            items: workbook!.items
              .filter((i) => i.title.trim())
              .map((i) => ({ ...i, questions: i.questions.split("\n").map((q) => q.trim()).filter(Boolean) })),
          };
      await actions.saveImport({
        weekId: props.weekId,
        kind: props.kind,
        origin: mode === "manual" ? "manual" : (preview?.origin ?? mode),
        contentHash: preview?.contentHash ?? null,
        sourceUrl: sourceUrl.trim() || null,
        overwrite,
        data,
      });
      toast.success("Import gespeichert.");
      router.push(weekHref(props.year, props.week));
    } catch (err) {
      toast.error(friendlyError(err));
      if (err instanceof actions.DuplicateImportError) setOverwrite(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Schritt 1: Art der Eingabe */}
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Importart">
        {(
          [
            ["text", ClipboardPaste, "Text einfügen"],
            ["manual", PenLine, "Manuell eingeben"],
          ] as const
        ).map(([m, Icon, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm transition-colors",
              mode === m ? "border-brand-mid bg-accent font-semibold text-accent-foreground" : "bg-surface hover:bg-muted",
            )}
          >
            <Icon className="size-5" /> {label}
          </button>
        ))}
      </div>

      {mode !== "manual" && !draftReady && (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="text" className="font-semibold">
                  Text aus der Veröffentlichung
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const clip = await navigator.clipboard.readText();
                      if (!clip.trim()) return toast.error("Die Zwischenablage ist leer.");
                      setText(clip);
                      toast.success(`${clip.length.toLocaleString("de-AT")} Zeichen eingefügt.`);
                    } catch {
                      toast.error("Zugriff auf die Zwischenablage nicht möglich – bitte ins Feld tippen und „Einsetzen“ wählen.");
                    }
                  }}
                >
                  <ClipboardPaste /> Aus Zwischenablage einfügen
                </Button>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                Tipp: Seite der Woche in der Online-Bibliothek öffnen, lange auf den Text tippen → „Alles auswählen“ → „Kopieren“, dann hier einfügen.
              </p>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-56 font-mono text-xs"
                placeholder={
                  isWt
                    ? "Kompletten Studienartikel einfügen (Titel, Leittext, nummerierte Absätze und Fragen) …"
                    : "Wochenprogramm einfügen (Schätze aus Gottes Wort, Uns im Dienst verbessern, Unser Leben als Christ) …"
                }
              />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Erkennung:</span>
              <select value={useAi} onChange={(e) => setUseAi(e.target.value as typeof useAi)} className="h-8 rounded-lg border bg-background px-2">
                <option value="auto">Automatisch</option>
                <option value="on" disabled={!props.aiEnabled}>
                  Immer mit KI
                </option>
                <option value="off">Nur Textmuster</option>
              </select>
            </label>
            <Button onClick={() => analyze()} disabled={loading} className="ml-auto h-10 px-4">
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? "Wird analysiert …" : "Analysieren"}
            </Button>
          </div>
        </div>
      )}

      {/* Schritt 2: Vorschau bearbeiten */}
      {draftReady && (
        <div className="space-y-5">
          {preview && (
            <div className="rounded-xl border bg-surface p-4 text-sm">
              <p>
                <strong>{preview.chars.toLocaleString("de-AT")}</strong> Zeichen gelesen · Erkennung:{" "}
                <strong>{preview.method === "ai" ? "KI (wörtlich geprüft)" : "Textmuster"}</strong>
              </p>
              {[...preview.warnings, ...preview.notes].map((w) => (
                <p key={w} className="mt-1.5 flex gap-2 text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" /> {w}
                </p>
              ))}
              {preview.duplicate && (
                <p className="mt-1.5 flex gap-2 font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Diese Veröffentlichung wurde für diese Woche bereits importiert.
                </p>
              )}
            </div>
          )}

          {isWt && choices.length > 1 && (
            <label className="block rounded-xl border bg-card p-4 text-sm">
              <span className="mb-1.5 block font-semibold">Studienartikel aus dieser Ausgabe</span>
              <select
                className="h-10 w-full rounded-lg border bg-background px-2.5"
                value={chosen}
                disabled={loading}
                onChange={(e) => {
                  setChosen(e.target.value);
                  analyze(e.target.value);
                }}
              >
                <option value="">Automatisch (passend zur Woche)</option>
                {choices.map((c) => (
                  <option key={c.number} value={c.number}>
                    Studienartikel {c.number}
                    {c.title ? ` – ${c.title.slice(0, 50)}` : ""}
                    {c.weekLabel ? ` · ${c.weekLabel}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isWt && article && <ArticleEditor draft={article} onChange={setArticle} />}
          {!isWt && workbook && <WorkbookEditor draft={workbook} onChange={setWorkbook} />}

          <div className="rounded-2xl border bg-card p-5">
            <Label htmlFor="src" className="mb-2 block font-semibold">
              Link zur Originalquelle auf jw.org <span className="font-normal text-muted-foreground">(empfohlen)</span>
            </Label>
            <Input id="src" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://www.jw.org/de/bibliothek/…" />
            {props.suggestedUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {props.suggestedUrls.map((s) => (
                  <button key={s.url} type="button" onClick={() => setSourceUrl(s.url)} className="max-w-full truncate rounded-full border px-2.5 py-1 text-xs hover:bg-muted">
                    {s.title}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Nur jw.org-Adressen werden akzeptiert. Der Inhalt wird als „benutzerseitig importiert“ gekennzeichnet.
            </p>
            {(props.hasExisting || preview?.duplicate) && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="size-4" />
                Bestehenden Import dieser Woche ersetzen (zugehörige KI-Antworten und Fortschritt werden zurückgesetzt)
              </label>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {mode !== "manual" && (
              <Button variant="ghost" onClick={() => (isWt ? setArticle(null) : setWorkbook(null))}>
                Zurück
              </Button>
            )}
            <Button onClick={save} disabled={saving || ((props.hasExisting || preview?.duplicate) && !overwrite)} className="h-10 px-5">
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Import speichern
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ArticleEditor({ draft, onChange }: { draft: ArticleDraft; onChange: (d: ArticleDraft) => void }) {
  const set = (patch: Partial<ArticleDraft>) => onChange({ ...draft, ...patch });
  const setP = (i: number, patch: Partial<ArticleDraft["paragraphs"][number]>) =>
    set({ paragraphs: draft.paragraphs.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <Field label="Titel des Artikels *" className="sm:col-span-2">
          <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={300} />
        </Field>
        <Field label="Studienartikel Nr.">
          <Input value={draft.studyNumber} onChange={(e) => set({ studyNumber: e.target.value })} maxLength={10} />
        </Field>
        <Field label="Ausgabe (z. B. September 2026)">
          <Input value={draft.issue} onChange={(e) => set({ issue: e.target.value })} maxLength={100} />
        </Field>
        <Field label="Leittext" className="sm:col-span-2">
          <Input value={draft.themeScripture} onChange={(e) => set({ themeScripture: e.target.value })} maxLength={1000} />
        </Field>
        <Field label="Lied">
          <Input value={draft.song} onChange={(e) => set({ song: e.target.value })} maxLength={200} />
        </Field>
        <Field label="Erscheinungsdatum">
          <Input value={draft.publishedAt} onChange={(e) => set({ publishedAt: e.target.value })} maxLength={100} />
        </Field>
        <Field label="Vorschau / Einleitung" className="sm:col-span-2">
          <Textarea value={draft.intro} onChange={(e) => set({ intro: e.target.value })} maxLength={3000} />
        </Field>
      </div>
      <h3 className="eyebrow text-muted-foreground">Absätze und Originalfragen ({draft.paragraphs.length})</h3>
      <ol className="space-y-3">
        {draft.paragraphs.map((p, i) => (
          <li key={i} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-end gap-2">
              <Field label="Absatz" className="w-24">
                <Input value={p.number} onChange={(e) => setP(i, { number: e.target.value })} maxLength={10} />
              </Field>
              <Field label="Originalfrage" className="flex-1">
                <Input value={p.question} onChange={(e) => setP(i, { question: e.target.value })} maxLength={2000} />
              </Field>
              <Button variant="ghost" size="icon" aria-label="Absatz entfernen" onClick={() => set({ paragraphs: draft.paragraphs.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
            <Textarea value={p.originalText} onChange={(e) => setP(i, { originalText: e.target.value })} className="reading-sm min-h-28" maxLength={20000} placeholder="Originaltext des Absatzes" />
          </li>
        ))}
      </ol>
      <Button
        variant="outline"
        onClick={() => set({ paragraphs: [...draft.paragraphs, { number: String(draft.paragraphs.length + 1), question: "", originalText: "" }] })}
      >
        <Plus /> Absatz hinzufügen
      </Button>
    </div>
  );
}

function WorkbookEditor({ draft, onChange }: { draft: WorkbookDraft; onChange: (d: WorkbookDraft) => void }) {
  const set = (patch: Partial<WorkbookDraft>) => onChange({ ...draft, ...patch });
  const setI = (i: number, patch: Partial<WorkbookDraft["items"][number]>) =>
    set({ items: draft.items.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <Field label="Titel der Woche *">
          <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={300} />
        </Field>
        <Field label="Bibelleseprogramm">
          <Input value={draft.bibleReading} onChange={(e) => set({ bibleReading: e.target.value })} maxLength={200} />
        </Field>
      </div>
      <h3 className="eyebrow text-muted-foreground">Programmpunkte ({draft.items.length})</h3>
      <ol className="space-y-3">
        {draft.items.map((it, i) => (
          <li key={i} className="rounded-xl border bg-card p-4">
            <div className="mb-2 grid gap-2 sm:grid-cols-[12rem_1fr_6rem_auto] sm:items-end">
              <Field label="Teil">
                <select value={it.section} onChange={(e) => setI(i, { section: e.target.value as WorkbookSection })} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                  {(Object.keys(SECTION_TITLES) as WorkbookSection[]).map((s) => (
                    <option key={s} value={s}>
                      {SECTION_TITLES[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Titel">
                <Input value={it.title} onChange={(e) => setI(i, { title: e.target.value })} maxLength={300} />
              </Field>
              <Field label="Dauer">
                <Input value={it.duration} onChange={(e) => setI(i, { duration: e.target.value })} maxLength={20} />
              </Field>
              <Button variant="ghost" size="icon" aria-label="Programmpunkt entfernen" onClick={() => set({ items: draft.items.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
            <Textarea value={it.originalText} onChange={(e) => setI(i, { originalText: e.target.value })} className="reading-sm mb-2 min-h-20" maxLength={20000} placeholder="Originaltext" />
            <Textarea value={it.questions} onChange={(e) => setI(i, { questions: e.target.value })} className="min-h-12 text-sm" placeholder="Fragen (eine pro Zeile)" />
          </li>
        ))}
      </ol>
      <Button variant="outline" onClick={() => set({ items: [...draft.items, { section: "leben", title: "", duration: "", originalText: "", questions: "" }] })}>
        <Plus /> Programmpunkt hinzufügen
      </Button>
    </div>
  );
}
