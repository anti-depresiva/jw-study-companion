"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { requestPersistence } from "@/lib/data/browser-store";
import { store } from "@/lib/data";
import { notifyChange, useData } from "@/lib/client/use-data";
import { configureAi } from "@/lib/ai/client";
import { checkWeek } from "@/lib/study/prepare";
import { currentWeek } from "@/lib/week";

/**
 * Übernimmt Darstellung/Schriftgröße aus dem Gerätespeicher, bittet um
 * dauerhaften Speicher und zeigt auf dem iPhone den Hinweis
 * „Zum Home-Bildschirm“ (sonst kann Safari die Daten nach Wochen löschen).
 */
export function AppBoot() {
  const { setTheme } = useTheme();
  const { data: settings } = useData(() => store.getSettings(), []);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTheme(settings.theme);
    document.documentElement.style.setProperty("--reading-scale", String(settings.fontScale));
  }, [settings, setTheme]);

  // Automatische Wochenprüfung beim Öffnen (höchstens alle 12 Stunden)
  useEffect(() => {
    if (!settings?.autoWeekCheck) return;
    const cw = currentWeek();
    store.getWeek(cw.year, cw.week).then((w) => {
      const stale = !w?.lastCheckedAt || Date.now() - Date.parse(w.lastCheckedAt) > 12 * 3600_000;
      if (!stale) return;
      configureAi(settings.anthropicKey, settings.anthropicModel);
      checkWeek(store, cw.year, cw.week, { search: settings.useWebSearch && !w })
        .then(() => notifyChange())
        .catch(() => undefined);
    });
  }, [settings]);

  useEffect(() => {
    requestPersistence();
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("jwps-install-hint") === "x";
    } catch {}
    // Browser-APIs sind erst nach dem Laden verfügbar (statisch vorgerenderte Seite).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowHint(ios && !standalone && !dismissed);
  }, []);

  if (!showHint) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[60] rounded-2xl border bg-popover p-4 text-sm shadow-xl" role="dialog" aria-label="App installieren">
      <button
        type="button"
        aria-label="Hinweis schließen"
        className="absolute top-2 right-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        onClick={() => {
          try {
            localStorage.setItem("jwps-install-hint", "x");
          } catch {}
          setShowHint(false);
        }}
      >
        <X className="size-4" />
      </button>
      <p className="pr-6 font-semibold">Bitte zum Home-Bildschirm hinzufügen</p>
      <p className="mt-1 text-muted-foreground">
        Tippe unten in Safari auf <Share className="inline size-4 align-text-bottom" /> „Teilen“ und dann auf „Zum Home-Bildschirm“. Nur so bleiben
        deine Daten dauerhaft auf dem iPhone gespeichert.
      </p>
    </div>
  );
}
