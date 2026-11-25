import { weekHref } from "@/lib/routes";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkbookSection } from "@/lib/types";
import { SECTION_TITLES } from "@/lib/types";
import { formatRange, shiftWeek, weekRange } from "@/lib/week";

export function PageHeader({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {eyebrow && <p className="eyebrow mb-1.5 text-brand-mid">{eyebrow}</p>}
      <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      {children && <div className="mt-2 text-muted-foreground">{children}</div>}
    </header>
  );
}

export function Container({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn("mx-auto w-full px-4 pt-5 sm:px-6 lg:pt-10", wide ? "max-w-5xl" : "max-w-3xl", className)}>
      {children}
    </div>
  );
}

/** Wochenumschalter wie in einer Bibliotheks-App: ‹ KW 48 · 23.–29. November 2026 › */
export function WeekSwitcher({ year, week }: { year: number; week: number }) {
  const prev = shiftWeek(year, week, -1);
  const next = shiftWeek(year, week, 1);
  const r = weekRange(year, week);
  return (
    <div className="mb-6 flex items-center justify-between gap-2 rounded-xl border bg-surface px-1.5 py-1.5">
      <Link
        href={weekHref(prev.year, prev.week)}
        className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Vorherige Woche"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="text-center leading-tight">
        <div className="text-sm font-semibold">Kalenderwoche {week}</div>
        <div className="text-xs text-muted-foreground">{formatRange(r.start, r.end)}</div>
      </div>
      <Link
        href={weekHref(next.year, next.week)}
        className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Nächste Woche"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-brand-mid transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

const SECTION_COLOR: Record<WorkbookSection, string> = {
  schaetze: "bg-sec-schaetze",
  dienst: "bg-sec-dienst",
  leben: "bg-sec-leben",
  versammlungsbibelstudium: "bg-sec-leben",
};

/** Farbiger Abschnittsbalken wie im gedruckten Arbeitsheft. */
export function SectionBand({ section, children }: { section: WorkbookSection; children?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between rounded-lg px-3.5 py-2 text-white", SECTION_COLOR[section])}>
      <h2 className="eyebrow text-[0.72rem] text-white">{SECTION_TITLES[section]}</h2>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-surface px-6 py-10 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground/70" aria-hidden />
      <h2 className="font-semibold">{title}</h2>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function sectionLetter(section: WorkbookSection) {
  return { schaetze: "A", dienst: "B", leben: "C", versammlungsbibelstudium: "D" }[section];
}
