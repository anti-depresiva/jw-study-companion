"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, KeyRound, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveSettings } from "@/lib/actions";
import { exportData, importData, requestPersistence, storageInfo } from "@/lib/data/browser-store";
import { notifyChange } from "@/lib/client/use-data";
import type { Settings } from "@/lib/types";
import { WEEKDAYS } from "@/lib/week";
import { cn } from "@/lib/utils";

function Row({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="font-medium">{title}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-0.5" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", value === v ? "bg-surface font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const selectClass = "h-9 rounded-lg border bg-background px-2.5 text-sm";

function formatBytes(n: number | null) {
  if (n == null) return "unbekannt";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const { setTheme } = useTheme();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [keyDraft, setKeyDraft] = useState(initial.anthropicKey);
  const [showKey, setShowKey] = useState(false);
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof storageInfo>> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storageInfo().then(setStorage).catch(() => undefined);
  }, []);

  async function update(patch: Partial<Settings>) {
    const prev = s;
    setS({ ...s, ...patch });
    if (patch.theme) setTheme(patch.theme);
    if (patch.fontScale) document.documentElement.style.setProperty("--reading-scale", String(patch.fontScale));
    setSaving(true);
    try {
      await saveSettings(patch);
    } catch (err) {
      setS(prev);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleNotifications(on: boolean) {
    if (on) {
      if (!("Notification" in window)) {
        toast.error("Benachrichtigungen sind nur in der installierten App (Home-Bildschirm) verfügbar.");
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") {
        toast.error("Benachrichtigungen wurden nicht erlaubt.");
        return;
      }
    }
    update({ notifications: on });
  }

  async function backup() {
    const data = await exportData(false);
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const name = `jw-plus-study-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], name, { type: "application/json" });
    // iPhone: Teilen-Menü (in „Dateien“ sichern); sonst normaler Download
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "JW+ Study Sicherung" });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function restore(file: File) {
    if (!confirm("Alle Daten auf diesem Gerät werden durch die Sicherung ersetzt. Fortfahren?")) return;
    try {
      await importData(JSON.parse(await file.text()));
      notifyChange();
      toast.success("Sicherung wiederhergestellt.");
      location.reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <section id="ki" className="scroll-mt-6 rounded-2xl border bg-card p-5">
        <p className="mb-1 flex items-center gap-2 font-medium">
          <KeyRound className="size-4 text-gold" /> Anthropic-API-Schlüssel
        </p>
        <p className="mb-3 text-sm text-muted-foreground">
          Wird nur auf diesem iPhone gespeichert und direkt an Anthropic gesendet. Nicht Teil der Sicherung. Schlüssel erstellen auf platform.claude.com.
        </p>
        <div className="flex gap-2">
          <Input
            type={showKey ? "text" : "password"}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-10 flex-1 font-mono text-sm"
          />
          <Button variant="ghost" size="icon-lg" aria-label={showKey ? "Schlüssel verbergen" : "Schlüssel anzeigen"} onClick={() => setShowKey((v) => !v)}>
            {showKey ? <EyeOff /> : <Eye />}
          </Button>
          <Button className="h-10 px-4" disabled={keyDraft === s.anthropicKey} onClick={() => update({ anthropicKey: keyDraft.trim() }).then(() => toast.success("Schlüssel gespeichert."))}>
            Speichern
          </Button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Modell:</span>
          <select className={selectClass} value={s.anthropicModel} onChange={(e) => update({ anthropicModel: e.target.value })}>
            <option value="claude-opus-5-5">Claude Opus 5.5 (beste Qualität)</option>
            <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (günstiger)</option>
            <option value="claude-haiku-5-5">Claude Haiku 5.5 (am günstigsten)</option>
          </select>
        </label>
      </section>

      <section id="profil" className="scroll-mt-6 divide-y rounded-2xl border bg-card">
        <Row title="Anzeigename" hint="Für die persönliche Begrüßung">
          <Input defaultValue={s.displayName} maxLength={60} className="w-56" onBlur={(e) => e.target.value !== s.displayName && update({ displayName: e.target.value.trim() })} />
        </Row>
        <Row title="Sprache">
          <select className={selectClass} value={s.language} disabled aria-label="Sprache">
            <option value="de">Deutsch</option>
          </select>
        </Row>
        <Row title="Bibelübersetzung" hint="Für die Formulierung der Antworten">
          <select className={selectClass} value={s.bibleTranslation} onChange={(e) => update({ bibleTranslation: e.target.value as Settings["bibleTranslation"] })} aria-label="Bibelübersetzung">
            <option value="nwtsty">Neue-Welt-Übersetzung (Studienbibel)</option>
            <option value="nwt">Neue-Welt-Übersetzung</option>
          </select>
        </Row>
      </section>

      <section className="divide-y rounded-2xl border bg-card">
        <Row title="Darstellung">
          <Segmented value={s.theme} options={[["light", "Hell"], ["dark", "Dunkel"], ["system", "System"]]} onChange={(theme) => update({ theme })} />
        </Row>
        <Row title="Schriftgröße" hint={`${Math.round(s.fontScale * 100)} %`}>
          <input
            type="range"
            min={0.9}
            max={1.4}
            step={0.05}
            value={s.fontScale}
            onChange={(e) => setS({ ...s, fontScale: Number(e.target.value) })}
            onPointerUp={(e) => update({ fontScale: Number((e.target as HTMLInputElement).value) })}
            onKeyUp={(e) => update({ fontScale: Number((e.target as HTMLInputElement).value) })}
            className="w-48 accent-[var(--brand-mid)]"
            aria-label="Schriftgröße"
          />
        </Row>
        <p className="reading px-5 py-4 text-muted-foreground" style={{ fontSize: `calc(1.0625rem * ${s.fontScale})` }}>
          Vorschau: So erscheint der Studientext in der Absatzansicht.
        </p>
      </section>

      <section className="divide-y rounded-2xl border bg-card">
        <Row title="Standardmäßig geöffnete Antwort" hint="Alle drei Varianten werden immer erstellt">
          <Segmented value={s.defaultVariant} options={[["short", "Kurz"], ["detailed", "Ausführlich"], ["personal", "Persönlich"]]} onChange={(defaultVariant) => update({ defaultVariant })} />
        </Row>
        <Row title="Standardlänge der Kommentare">
          <Segmented value={s.commentLength} options={[["kurz", "Kurz"], ["mittel", "Mittel"], ["lang", "Lang"]]} onChange={(commentLength) => update({ commentLength })} />
        </Row>
      </section>

      <section className="divide-y rounded-2xl border bg-card">
        <Row title="Zusammenkunft unter der Woche">
          <select className={selectClass} value={s.midweekDay} onChange={(e) => update({ midweekDay: Number(e.target.value) })} aria-label="Wochentag unter der Woche">
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </Row>
        <Row title="Zusammenkunft am Wochenende">
          <select className={selectClass} value={s.weekendDay} onChange={(e) => update({ weekendDay: Number(e.target.value) })} aria-label="Wochentag am Wochenende">
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </Row>
        <Row title="Automatische Wochenprüfung" hint="Legt beim Öffnen der App die neue Woche an und vermerkt die Quellen">
          <Switch checked={s.autoWeekCheck} onCheckedChange={(v: boolean) => update({ autoWeekCheck: v })} aria-label="Automatische Wochenprüfung" />
        </Row>
        <Row title="Quellensuche auf jw.org" hint="Nutzt die auf jw.org beschränkte Websuche der Claude-API (verursacht API-Kosten)">
          <Switch checked={s.useWebSearch} onCheckedChange={(v: boolean) => update({ useWebSearch: v })} aria-label="Quellensuche auf jw.org" />
        </Row>
        <Row title="Benachrichtigungen" hint="Hinweis, wenn eine Woche fertig vorbereitet ist (nur in der installierten App)">
          <Switch checked={s.notifications} onCheckedChange={(v: boolean) => toggleNotifications(v)} aria-label="Benachrichtigungen" />
        </Row>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <p className="font-medium">Daten auf diesem Gerät</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Alles ist ausschließlich auf diesem iPhone gespeichert (belegt: {formatBytes(storage?.usage ?? null)}). Dauerhafter Speicher:{" "}
          {storage?.persisted ? "aktiv" : "nicht bestätigt – App zum Home-Bildschirm hinzufügen"}.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Erstelle regelmäßig eine Sicherung (z. B. in „Dateien“ oder iCloud Drive). Ohne Sicherung sind die Daten bei Verlust des Geräts weg.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 px-4" onClick={backup}>
            <Download /> Sicherung exportieren
          </Button>
          <Button variant="outline" className="h-10 px-4" onClick={() => fileRef.current?.click()}>
            <Upload /> Sicherung wiederherstellen
          </Button>
          {!storage?.persisted && (
            <Button variant="ghost" className="h-10 px-4" onClick={async () => setStorage({ ...(await storageInfo()), persisted: await requestPersistence() })}>
              Dauerhaften Speicher anfordern
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {saving ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" /> Speichert …
          </span>
        ) : (
          "Änderungen werden automatisch gespeichert."
        )}
      </p>
    </div>
  );
}
