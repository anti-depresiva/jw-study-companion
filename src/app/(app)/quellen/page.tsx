"use client";

import Link from "next/link";
import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { LoadError, Loading } from "@/components/study/loading";
import { VERIFICATION_TEXT } from "@/components/study/source-block";
import { Container, PageHeader } from "@/components/study/ui";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";
import { weekHref } from "@/lib/routes";
import { ALLOWED_HOSTS } from "@/lib/sources/domain";

export default function SourcesPage() {
  const { data, error } = useData(() => Promise.all([store.listSources(), store.listWeeks()]), []);
  const weekById = new Map((data?.[1] ?? []).map((w) => [w.id, w]));

  return (
    <Container>
      <PageHeader eyebrow="Quellenverwaltung" title="Offizielle Quellen">
        Alle Inhalte stammen ausschließlich von {[...ALLOWED_HOSTS].join(", ")}. Andere Domains werden abgelehnt.
      </PageHeader>
      {error ? (
        <LoadError error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {data[0].length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Noch keine Quellen gespeichert.</li>}
          {data[0].map((s) => {
            const w = s.weekId ? weekById.get(s.weekId) : null;
            const ok = !["unverified_pattern", "rejected"].includes(s.verification);
            return (
              <li key={s.id} className="flex items-start gap-3 px-5 py-3">
                {ok ? <ShieldCheck className="mt-0.5 size-4 text-success" /> : <ShieldAlert className="mt-0.5 size-4 text-gold" />}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {VERIFICATION_TEXT[s.verification]}
                    {w && (
                      <>
                        {" · "}
                        <Link href={`${weekHref("/zusammenkuenfte", w.year, w.week)}#quellen`} className="hover:underline">
                          KW {w.week}/{w.year}
                        </Link>
                      </>
                    )}
                  </p>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-mid hover:underline">
                      <span className="truncate">{s.url}</span> <ExternalLink className="size-3 shrink-0" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
