"use client";

import { friendlyError } from "@/lib/ai/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  FileWarning,
  Loader2,
  MessageCircleQuestion,
  MessagesSquare,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  StickyNote,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Textarea } from "@/components/ui/textarea";
import * as actions from "@/lib/actions";
import { NoSourceError } from "@/lib/study/targets";
import type { AnswerSet, Lookup, SourceRef, TargetType, Variant } from "@/lib/types";
import type { Reference } from "@/lib/references";
import { References } from "./references";
import { COMMENT_KIND_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContentLabel } from "./labels";
import { OfficialSources } from "./source-block";

export interface StudyViewProps {
  targetType: TargetType;
  weekId: string;
  targetId: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  questions: string[];
  questionLabel: string;
  originalText: string;
  scriptureLinks: Array<{ label: string; url: string }>;
  answer: AnswerSet | null;
  sourceRef: SourceRef;
  sourceReady: boolean;
  note: string;
  prepared: boolean;
  defaultVariant: Variant;
  favoriteTexts: Array<{ id: string; text: string }>;
  favLabel: string;
  aiEnabled: boolean;
  importHref: string;
  references: Reference[];
  lookups: Lookup[];
  backHref: string;
  backLabel: string;
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
  position: string;
}

const VARIANTS: Array<{ key: Variant; title: string; hint: string }> = [
  { key: "short", title: "Kurze Antwort", hint: "ca. 15–25 Sekunden" },
  { key: "detailed", title: "Ausführliche Antwort", hint: "vertiefend, mit Bibelstelle" },
  { key: "personal", title: "Persönliche Anwendung", hint: "praktisch für den Alltag" },
];

export function StudyView(props: StudyViewProps) {
  const [answer, setAnswer] = useState(props.answer);
  const [busy, setBusy] = useState<null | "generate" | "regenerate" | "comments">(null);
  const [error, setError] = useState<{ message: string; noSource: boolean } | null>(null);
  const [prepared, setPrepared] = useState(props.prepared);
  const target = { weekId: props.weekId, targetType: props.targetType, targetId: props.targetId };

  async function generate(mode: "generate" | "regenerate") {
    setBusy(mode);
    setError(null);
    try {
      setAnswer(await actions.generateAnswers(target, mode));
      toast.success(mode === "regenerate" ? "Neue Antworten erstellt – frühere Fassungen findest du unten." : "Antworten erstellt.");
    } catch (err) {
      setError({ message: friendlyError(err), noSource: err instanceof NoSourceError });
    } finally {
      setBusy(null);
    }
  }

  async function moreComments() {
    setBusy("comments");
    setError(null);
    try {
      setAnswer(await actions.moreComments(target));
      toast.success("Weitere Kommentare erstellt.");
    } catch (err) {
      setError({ message: friendlyError(err), noSource: err instanceof NoSourceError });
    } finally {
      setBusy(null);
    }
  }

  async function togglePrepared() {
    const nextValue = !prepared;
    setPrepared(nextValue);
    try {
      await actions.setPrepared(target, nextValue);
      if (nextValue) toast.success("Als vorbereitet markiert.");
    } catch (err) {
      setPrepared(!nextValue);
      toast.error(friendlyError(err));
    }
  }

  return (
    <div className="fade-in">
      <nav className="mb-4 flex items-center justify-between text-sm">
        <Link href={props.backHref} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {props.backLabel}
        </Link>
        <span className="text-muted-foreground tabular-nums">{props.position}</span>
      </nav>

      <header className="mb-5">
        <p className="eyebrow text-brand-mid">{props.eyebrow}</p>
        <h1 className="mt-1 text-[1.6rem] leading-tight font-semibold tracking-tight sm:text-3xl">{props.title}</h1>
        {props.subtitle && <p className="mt-1 text-muted-foreground">{props.subtitle}</p>}
      </header>

      {/* Originalfrage */}
      {props.questions.length > 0 && (
        <section className="mb-4 rounded-xl border-l-[3px] border-brand-mid bg-accent/60 px-4 py-3">
          <p className="eyebrow mb-1 text-brand-mid">{props.questionLabel}</p>
          {props.questions.map((q) => (
            <p key={q} className="text-[1.05rem] font-semibold leading-snug">
              {q}
            </p>
          ))}
        </section>
      )}

      {/* Originaltext */}
      <Collapsible
        defaultOpen
        header={<ContentLabel kind="original" />}
        className="mb-6"
      >
        <div className="reading whitespace-pre-line">{props.originalText || "—"}</div>
        {props.scriptureLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <ContentLabel kind="bible" />
            {props.scriptureLinks.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-success/30 px-2.5 py-1 text-sm text-success hover:bg-success/10"
              >
                <BookOpen className="size-3.5" /> {s.label}
              </a>
            ))}
          </div>
        )}
      </Collapsible>

      {/* KI-Antworten */}
      {!answer ? (
        <section className="mb-6 rounded-2xl border border-dashed bg-surface p-5 text-center">
          <Sparkles className="mx-auto mb-2 size-6 text-gold" />
          <h2 className="font-semibold">Noch keine Antworten erstellt</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {props.sourceReady
              ? "Claude erstellt drei Antwortvarianten – ausschließlich auf Grundlage des Originaltextes oben."
              : "Dazu konnte keine passende offizielle Quelle auf jw.org gefunden werden."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {props.sourceReady ? (
              <Button onClick={() => generate("generate")} disabled={busy !== null || !props.aiEnabled} size="lg">
                {busy === "generate" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {busy === "generate" ? "Antworten werden erstellt …" : "Drei Antworten erstellen"}
              </Button>
            ) : (
              <ButtonLink href={props.importHref} size="lg">
                <Upload /> Quelle importieren
              </ButtonLink>
            )}
          </div>
          {!props.aiEnabled && <p className="mt-3 text-xs text-muted-foreground">KI nicht eingerichtet – bitte den API-Schlüssel in den Einstellungen eintragen.</p>}
        </section>
      ) : (
        <section className="mb-6 space-y-3" aria-label="Antwortvarianten">
          {VARIANTS.map((v) => (
            <AnswerCard
              key={v.key}
              title={v.title}
              hint={v.hint}
              text={answer[v.key]}
              defaultOpen={props.defaultVariant === v.key}
              favLabel={`${props.favLabel} · ${v.title}`}
              variant={v.key}
              target={target}
              favoriteTexts={props.favoriteTexts}
            />
          ))}
          {answer.extraThought && (
            <div className="rounded-xl border border-gold/30 bg-gold-soft/70 p-4">
              <ContentLabel kind="extra" />
              <p className="reading-sm mt-2">{answer.extraThought}</p>
            </div>
          )}
          {answer.warnings.length > 0 && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
              {answer.warnings.map((w) => (
                <p key={w} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /> {w}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            KI-Antworten von Claude ({answer.model}), erstellt am {new Date(answer.generatedAt).toLocaleString("de-AT")}. Bitte stets mit dem
            Originaltext vergleichen.
          </p>
        </section>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm" role="alert">
          <p className="flex gap-2 font-medium">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-destructive" /> {error.message}
          </p>
          {error.noSource && (
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink size="sm" variant="outline" href={`${props.importHref}&mode=text`}>
                Quelle einfügen
              </ButtonLink>
              <ButtonLink size="sm" variant="outline" href={`${props.importHref}&mode=manual`}>
                Text manuell eingeben
              </ButtonLink>
            </div>
          )}
        </div>
      )}

      {/* Aktionen */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button variant={prepared ? "secondary" : "default"} onClick={togglePrepared} className="h-10 px-4">
          {prepared ? <CheckCircle2 className="text-success" /> : <Circle />}
          {prepared ? "Vorbereitet" : "Als vorbereitet markieren"}
        </Button>
        {answer && (
          <>
            <Button variant="outline" className="h-10 px-4" onClick={() => generate("regenerate")} disabled={busy !== null || !props.aiEnabled}>
              {busy === "regenerate" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Weitere Antwort generieren
            </Button>
            <Button variant="outline" className="h-10 px-4 font-semibold" onClick={moreComments} disabled={busy !== null || !props.aiEnabled}>
              {busy === "comments" ? <Loader2 className="animate-spin" /> : <MessagesSquare />}
              WEITERE KOMMENTARE GENERIEREN
            </Button>
          </>
        )}
      </div>

      {answer && answer.extraComments.length > 0 && (
        <section className="mb-6">
          <h2 className="eyebrow mb-2 text-muted-foreground">Weitere Kommentare</h2>
          <ul className="space-y-2">
            {[...answer.extraComments].reverse().map((c) => (
              <li key={c.id} className="rounded-xl border bg-card p-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <ContentLabel kind="ai">{COMMENT_KIND_LABELS[c.kind]}</ContentLabel>
                  <div className="flex gap-1">
                    <CopyButton text={c.text} />
                    <FavoriteButton text={c.text} label={`${props.favLabel} · ${COMMENT_KIND_LABELS[c.kind]}`} variant="comment" target={target} favoriteTexts={props.favoriteTexts} />
                  </div>
                </div>
                <p className="reading-sm">{c.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <References target={target} references={props.references} lookups={props.lookups} aiEnabled={props.aiEnabled} />

      <div className="mb-6">
        <OfficialSources sourceRef={answer?.sourceRef ?? props.sourceRef} />
      </div>

      <NoteEditor target={target} initial={props.note} />

      <Assistant target={target} enabled={props.aiEnabled && props.sourceReady} />

      {/* Absatznavigation */}
      <nav className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mt-8 grid grid-cols-2 gap-2 rounded-2xl border bg-surface/95 p-2 shadow-lg backdrop-blur lg:bottom-4">
        {props.prev ? (
          <Link href={props.prev.href} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-muted">
            <ChevronLeft className="size-4 shrink-0" />
            <span className="truncate">
              <span className="block text-xs text-muted-foreground">Vorheriger</span>
              {props.prev.label}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {props.next ? (
          <Link href={props.next.href} className="flex items-center justify-end gap-2 rounded-xl px-3 py-2.5 text-right text-sm hover:bg-muted">
            <span className="truncate">
              <span className="block text-xs text-muted-foreground">Nächster</span>
              {props.next.label}
            </span>
            <ChevronRight className="size-4 shrink-0" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function Collapsible({
  header,
  children,
  defaultOpen,
  className,
  right,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left">
          {header}
          <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
        {right}
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

type Target = { weekId: string; targetType: TargetType; targetId: string };

function AnswerCard(props: {
  title: string;
  hint: string;
  text: string;
  defaultOpen: boolean;
  favLabel: string;
  variant: Variant;
  target: Target;
  favoriteTexts: Array<{ id: string; text: string }>;
}) {
  return (
    <Collapsible
      defaultOpen={props.defaultOpen}
      header={
        <span className="flex flex-wrap items-center gap-2">
          <ContentLabel kind="ai" />
          <span className="font-semibold">{props.title}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">{props.hint}</span>
        </span>
      }
      right={
        <span className="flex gap-1">
          <CopyButton text={props.text} />
          <FavoriteButton text={props.text} label={props.favLabel} variant={props.variant} target={props.target} favoriteTexts={props.favoriteTexts} />
        </span>
      }
    >
      <p className="reading">{props.text}</p>
    </Collapsible>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Antwort kopieren"
      title="Kopieren"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("In die Zwischenablage kopiert.");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Kopieren nicht möglich.");
        }
      }}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  );
}

function FavoriteButton(props: {
  text: string;
  label: string;
  variant: Variant | "comment";
  target: Target;
  favoriteTexts: Array<{ id: string; text: string }>;
}) {
  const [favId, setFavId] = useState<string | null>(props.favoriteTexts.find((f) => f.text === props.text)?.id ?? null);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={favId ? "Aus Favoriten entfernen" : "Als Favorit speichern"}
      aria-pressed={Boolean(favId)}
      title={favId ? "Favorit entfernen" : "Als Favorit speichern"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (favId) {
            await actions.removeFavorite(favId);
            setFavId(null);
            toast("Favorit entfernt.");
          } else {
            const fav = await actions.addFavorite(props.target, { variant: props.variant, label: props.label, text: props.text });
            setFavId(fav.id);
            toast.success("Als Favorit gespeichert.");
          }
        } catch (err) {
          toast.error(friendlyError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Star className={cn(favId && "fill-gold text-gold")} />
    </Button>
  );
}

function NoteEditor({ target, initial }: { target: Target; initial: string }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const last = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = async (value: string) => {
    if (value === last.current) return;
    setState("saving");
    try {
      await actions.saveNote(target, value);
      last.current = value;
      setState("saved");
    } catch {
      setState("error");
    }
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <section className="mb-6 rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="note" className="flex items-center gap-2 font-semibold">
          <StickyNote className="size-4 text-gold" /> Persönliche Notiz
        </label>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {state === "saving" ? "Wird gespeichert …" : state === "saved" ? "Gespeichert" : state === "error" ? "Speichern fehlgeschlagen" : ""}
        </span>
      </div>
      <Textarea
        id="note"
        value={text}
        placeholder="Eigene Gedanken, Erfahrungen oder einen Kommentar in deinen Worten …"
        className="reading-sm min-h-24"
        maxLength={20000}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => save(v), 900);
        }}
        onBlur={() => save(text)}
      />
    </section>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string }>;
  warnings?: string[];
}

const QUICK_PROMPTS = [
  "Erkläre die Bibelstelle aus diesem Abschnitt im Kontext.",
  "Formuliere einen natürlichen Kommentar in einfachen Worten.",
  "Welcher Kerngedanke ist hier besonders wichtig?",
];

function Assistant({ target, enabled }: { target: Target; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const res = await actions.ask(target, history.map(({ role, content: c }) => ({ role, content: c })));
      setMessages([...history, { role: "assistant", content: res.text, sources: res.sources, warnings: res.warnings }]);
    } catch (err) {
      setMessages(history.slice(0, -1));
      setInput(content);
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold"
      >
        <MessageCircleQuestion className="size-4 text-brand-mid" /> Studienassistent fragen
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t px-4 py-4">
          {!enabled ? (
            <p className="text-sm text-muted-foreground">Der Assistent benötigt den Originaltext dieses Abschnitts und einen eingerichteten API-Schlüssel.</p>
          ) : (
            <>
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((q) => (
                      <button key={q} type="button" onClick={() => send(q)} className="rounded-full border px-3 py-1.5 text-left text-sm hover:bg-muted">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn("rounded-xl px-3.5 py-2.5", m.role === "user" ? "ml-8 bg-secondary" : "mr-4 border bg-surface")}>
                    {m.role === "assistant" && <ContentLabel kind="ai" className="mb-1.5" />}
                    <p className="reading-sm whitespace-pre-line">{m.content}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 border-t pt-2">
                        <ContentLabel kind="source">Offizielle Quellen</ContentLabel>
                        <ul className="mt-1 space-y-0.5 text-sm">
                          {m.sources.map((s) => (
                            <li key={s.url}>
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-mid hover:underline">
                                {s.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.warnings?.map((w) => (
                      <p key={w} className="mt-1.5 flex gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="size-3.5 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                ))}
                {busy && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Der Assistent prüft das Studienmaterial …
                  </p>
                )}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Frage zu diesem Abschnitt …"
                  className="min-h-11 flex-1"
                  maxLength={4000}
                  rows={1}
                />
                <Button type="submit" size="icon-lg" disabled={busy || !input.trim()} aria-label="Senden">
                  <Send />
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">Antworten beruhen auf dem Originaltext und – falls aktiviert – auf einer auf jw.org beschränkten Suche.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
