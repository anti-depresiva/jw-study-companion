"use client";

import { AppIcon } from "@/components/brand/logo";
import { SettingsForm } from "@/components/settings/settings-form";
import { LoadError, Loading } from "@/components/study/loading";
import { Container, PageHeader } from "@/components/study/ui";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";

export default function SettingsPage() {
  // Nur einmal laden – das Formular verwaltet seinen Zustand selbst.
  const { data, error } = useData(() => store.getSettings(), []);
  return (
    <Container>
      <PageHeader eyebrow="Persönlich" title="Einstellungen">
        Alle Daten bleiben auf diesem Gerät.
      </PageHeader>
      {error ? <LoadError error={error} /> : !data ? <Loading /> : <SettingsForm key="form" initial={data} />}

      <div className="mt-10 flex items-center gap-4 rounded-2xl border bg-card p-5">
        <AppIcon className="size-14 rounded-2xl" />
        <div className="text-sm">
          <p className="font-semibold">JW+ Study Companion</p>
          <p className="text-muted-foreground">Dein persönlicher Studienbegleiter · Your Personal Study Companion</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Privates, inoffizielles Studienwerkzeug. Nicht mit Jehovas Zeugen, der Wachtturm-Gesellschaft oder jw.org verbunden. Inhalte stammen aus
            offiziellen Veröffentlichungen auf jw.org und werden vom Benutzer selbst importiert.
          </p>
        </div>
      </div>
    </Container>
  );
}
