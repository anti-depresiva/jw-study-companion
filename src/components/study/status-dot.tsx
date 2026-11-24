import { cn } from "@/lib/utils";
import type { WeekStatus } from "@/lib/types";

const MAP: Record<WeekStatus, [string, string]> = {
  leer: ["bg-muted-foreground/40", "Leer"],
  quellen_erkannt: ["bg-gold", "Quellen erkannt"],
  importiert: ["bg-brand-mid", "Importiert"],
  vorbereitet: ["bg-success", "Vorbereitet"],
};

export function StatusDot({ status }: { status: WeekStatus }) {
  const [color, label] = MAP[status] ?? MAP.leer;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}
