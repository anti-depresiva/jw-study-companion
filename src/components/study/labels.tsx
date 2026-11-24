import { BookOpen, FileText, Lightbulb, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type LabelKind = "original" | "ai" | "extra" | "bible" | "source";

const CONFIG: Record<LabelKind, { text: string; icon: typeof FileText; className: string }> = {
  original: { text: "Originaltext", icon: FileText, className: "text-foreground/70 bg-muted" },
  ai: { text: "KI-Antwort", icon: Sparkles, className: "text-brand-mid bg-accent" },
  extra: { text: "Zusätzlicher Gedanke", icon: Lightbulb, className: "text-gold bg-gold-soft" },
  bible: { text: "Bibelstelle", icon: BookOpen, className: "text-success bg-success/10" },
  source: { text: "Offizielle Quelle", icon: ShieldCheck, className: "text-brand bg-secondary" },
};

/** Visuelle Kennzeichnung der Herkunft eines Inhalts (Abschnitt 16.5). */
export function ContentLabel({ kind, children, className }: { kind: LabelKind; children?: React.ReactNode; className?: string }) {
  const c = CONFIG[kind];
  return (
    <span className={cn("eyebrow inline-flex items-center gap-1.5 rounded-md px-2 py-1", c.className, className)}>
      <c.icon className="size-3.5" aria-hidden />
      {children ?? c.text}
    </span>
  );
}
