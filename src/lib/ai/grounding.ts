import { findScriptures, isCovered, type ScriptureRef } from "@/lib/scripture";

/**
 * Technische Quellenprüfung für KI-Texte: Jede in einem Text genannte
 * Bibelstelle muss im Originalmaterial vorkommen.
 */
export function allowedRefs(...sources: Array<string | null | undefined>): ScriptureRef[] {
  return findScriptures(sources.filter(Boolean).join("\n"));
}

export interface GroundingResult {
  ok: boolean;
  invented: string[];
}

export function checkGrounding(texts: string[], allowed: ScriptureRef[]): GroundingResult {
  const invented = new Set<string>();
  for (const t of texts) {
    for (const ref of findScriptures(t)) if (!isCovered(ref, allowed)) invented.add(ref.label);
  }
  return { ok: invented.size === 0, invented: [...invented] };
}

/** Filtert eine von der KI gelieferte Bibelstellenliste auf belegte Stellen. */
export function filterScriptureList(list: string[], allowed: ScriptureRef[]): string[] {
  const out: string[] = [];
  for (const item of list) {
    const refs = findScriptures(item);
    for (const r of refs) if (isCovered(r, allowed) && !out.includes(r.label)) out.push(r.label);
  }
  return out;
}
