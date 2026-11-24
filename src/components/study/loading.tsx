import { Loader2 } from "lucide-react";

export function Loading({ label = "Wird geladen …" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function LoadError({ error }: { error: Error }) {
  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm" role="alert">
      Die Daten konnten nicht geladen werden: {error.message}
    </div>
  );
}
