import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import type { SourceRef, Verification } from "@/lib/types";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { bibleLookupUrl } from "@/lib/sources/links";
import { ContentLabel } from "./labels";

export const VERIFICATION_TEXT: Record<Verification, string> = {
  unverified_pattern: "Linkmuster – ungeprüft",
  verified_link: "Link geprüft",
  verified_search: "Über jw.org-Suche gefunden",
  user_confirmed: "Vom Benutzer bestätigt",
  user_import: "Benutzerseitig importiert",
  rejected: "Verworfen",
};

/** Bereich „OFFIZIELLE QUELLEN“ unter jeder Antwort (Abschnitt 16.3). */
export function OfficialSources({ sourceRef }: { sourceRef: SourceRef }) {
  const url = sourceRef.url && checkOfficialUrl(sourceRef.url).ok ? sourceRef.url : null;
  return (
    <section className="rounded-xl border border-brand/15 bg-secondary/50 p-4" aria-label="Offizielle Quellen">
      <ContentLabel kind="source">Offizielle Quellen</ContentLabel>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Veröffentlichung</dt>
        <dd>{sourceRef.publication}</dd>
        <dt className="text-muted-foreground">Titel</dt>
        <dd className="font-medium">{sourceRef.title}</dd>
        <dt className="text-muted-foreground">Abschnitt</dt>
        <dd>{sourceRef.section}</dd>
        {sourceRef.date && (
          <>
            <dt className="text-muted-foreground">Datum</dt>
            <dd>{sourceRef.date}</dd>
          </>
        )}
        {sourceRef.scriptures.length > 0 && (
          <>
            <dt className="text-muted-foreground">Bibelstellen</dt>
            <dd className="flex flex-wrap gap-1.5">
              {sourceRef.scriptures.map((s) => (
                <a key={s} href={bibleLookupUrl(s)} target="_blank" rel="noopener noreferrer" className="text-success underline-offset-2 hover:underline">
                  {s}
                </a>
              ))}
            </dd>
          </>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand/10 pt-3 text-sm">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-mid hover:underline">
            Originalquelle auf jw.org öffnen <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span className="text-muted-foreground">Kein direkter jw.org-Link hinterlegt.</span>
        )}
        {sourceRef.verification && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            {sourceRef.verification === "rejected" || sourceRef.verification === "unverified_pattern" ? (
              <ShieldAlert className="size-3.5 text-gold" />
            ) : (
              <ShieldCheck className="size-3.5 text-success" />
            )}
            {VERIFICATION_TEXT[sourceRef.verification]}
          </span>
        )}
      </div>
      {sourceRef.userImported && (
        <p className="mt-2 text-xs text-muted-foreground">
          Der Originaltext wurde vom Benutzer aus einer offiziellen Veröffentlichung importiert.
          {url && sourceRef.section && " Die Absatzangabe bezieht sich auf den verlinkten Artikel."}
        </p>
      )}
    </section>
  );
}
