# JW+ Study Companion

**Dein persönlicher Studienbegleiter** · *Your Personal Study Companion*

Private Web-App (PWA) für die persönliche Vorbereitung auf die wöchentlichen Zusammenkünfte – fürs iPhone, mit KI-Antworten von Claude, strenger Quellenbindung an jw.org, Wochenarchiv, Notizen, Favoriten und Fortschritt.

> Privates, inoffizielles Studienwerkzeug für den Eigengebrauch. Nicht mit Jehovas Zeugen, der Wachtturm-Gesellschaft oder jw.org verbunden.

## Datenschutz: alles bleibt auf dem iPhone

| Was | Wo |
|---|---|
| Wochen, importierte Texte, KI-Antworten, Notizen, Favoriten, Fortschritt, Einstellungen | **Nur auf dem iPhone** (Browser-Datenbank IndexedDB) |
| Anthropic-API-Schlüssel | Nur auf dem iPhone; nicht in der Sicherung |
| Programmcode | GitHub Pages (enthält **keine** Daten, keinen Schlüssel, keine jw.org-Inhalte) |
| KI-Anfragen | Der jeweilige Absatz geht direkt vom iPhone an Anthropic (Claude). Es gibt keinen eigenen Server. |

Es gibt keinen Server, keine Datenbank in der Cloud, kein Konto und keine Anmeldung. Die Seite ist für Suchmaschinen gesperrt (`robots.txt`, `noindex`).

**Wichtig fürs iPhone:** Die App in Safari öffnen → Teilen → **„Zum Home-Bildschirm“**. Nur als installierte App bleiben die Daten dauerhaft erhalten. Und regelmäßig unter *Einstellungen → Sicherung exportieren* eine Sicherung in „Dateien“/iCloud Drive ablegen.

## Funktionen

- **Diese Woche (Startseite):** Wochenumschalter, Woche laden, Arbeitsheft und Wachtturm-Studium auf einer Seite mit Antwortfeldern.
- **Absatzansicht:** Originalfrage, Originaltext, **drei Antwortvarianten** (kurz · ausführlich · persönlich), zusätzlicher Gedanke, Bibelstellen, **Offizielle Quellen**; kopieren, Favorit, Notiz, weitere Antwort, **WEITERE KOMMENTARE GENERIEREN**, als vorbereitet markieren, Studienassistent, vorheriger/nächster Absatz.
- **Woche laden:** per Knopfdruck von wol.jw.org (siehe unten); als Ausweichweg Text einfügen oder manuelle Eingabe → bearbeitbare Vorschau.
- **Favoriten, Archiv, Einstellungen** (API-Schlüssel, Modell, Bibelübersetzung, Hell/Dunkel, Schriftgröße, Standard-Antwort, Kommentarlänge, Wochentage, automatische Wochenprüfung beim Öffnen, jw.org-Suche, Benachrichtigungen, Sicherung).

## Woche laden und Antwortfelder

- **„Woche von wol.jw.org laden“** (Zusammenkünfte-Seite): Claude ruft per Knopfdruck die Seite der Woche in der Online-Bibliothek ab (Anthropic-Server, nur jw.org erlaubt) sowie den dort verlinkten Wachtturm-Studienartikel. Übernommen wird der **Originaltext** der Seiten, nicht Claudes Formulierung. Benötigt den API-Schlüssel; kostet pro Woche wenige Cent. Ob jw.org den Abruf zulässt, entscheidet die Seite selbst – sonst „Text einfügen“ (mit Knopf „Aus Zwischenablage einfügen“).
- **Versammlungsbibelstudium**: Der auf der Wochenseite verlinkte Stoff wird beim Laden mitabgerufen (nur der angegebene Absatzbereich) – mit Fragen und Antwortfeldern wie beim Wachtturm.
- **Textmarker** wie in JW Library: Text auswählen → Farbe antippen; Markierung antippen → Farbe ändern oder entfernen. Bleibt beim Neuladen der Woche erhalten, nur auf dem Gerät gespeichert.
- **Wochenseite im Aufbau der Online-Bibliothek**: Programmpunkte mit Dauer, blau verlinkte Bibelstellen und Verweise, unter jeder Frage ein **graues Antwortfeld**. „Alle Felder ausfüllen“ schreibt kurze KI-Antworten hinein; die Felder sind frei bearbeitbar, selbst geschriebene Antworten werden nie überschrieben.

## Quellenregeln (technisch umgesetzt)

- **Nur jw.org:** Jede URL muss HTTPS sein und exakt `jw.org`, `www.jw.org` oder `wol.jw.org` als Host haben (`src/lib/sources/domain.ts`).
- **Jw.org-Suche:** Claude-Websuche mit `allowed_domains: ["jw.org"]`; ein Link wird nur übernommen, wenn er wörtlich in den Suchergebnissen vorkam.
- **Keine erfundenen Bibelstellen:** Jede Bibelstelle einer KI-Antwort wird gegen den Originalabsatz geprüft (Korrekturdurchlauf, sonst sichtbare Warnung).
- **Keine Antwort ohne Quelle:** Ohne Originaltext und Quelle erscheint *„Dazu konnte keine passende offizielle Quelle auf jw.org gefunden werden.“*
- **Wörtlichkeitsprüfung beim KI-Import:** Nicht wörtlich in der Vorlage stehende Absätze werden verworfen.
- **Kennzeichnung:** ORIGINALTEXT · KI-ANTWORT · ZUSÄTZLICHER GEDANKE · BIBELSTELLE · OFFIZIELLE QUELLE; Importe als „benutzerseitig importiert“.
- **Kein automatisches Abrufen von jw.org:** Seiten werden nur abgerufen, wenn du „Woche von wol.jw.org laden“ tippst.

## Auf GitHub Pages veröffentlichen (einmalig)

1. Auf <https://github.com> ein **neues Repository** anlegen, Name z. B. `jw-study-companion`. (Bei einem kostenlosen Konto muss es öffentlich sein, damit GitHub Pages funktioniert; der Code enthält keine persönlichen Daten.)
2. Im Projektordner:
   ```powershell
   git remote add origin https://github.com/<DEIN-BENUTZERNAME>/jw-study-companion.git
   git push -u origin main
   ```
   (Beim ersten Push öffnet sich die GitHub-Anmeldung.)
3. Im Repository: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
4. Unter **Actions** läuft „Auf GitHub Pages veröffentlichen“ (ca. 2 Minuten). Danach ist die App erreichbar unter
   `https://<DEIN-BENUTZERNAME>.github.io/jw-study-companion/`
5. Auf dem iPhone in **Safari** öffnen → Teilen → **Zum Home-Bildschirm**.
6. In der App: **Einstellungen → Anthropic-API-Schlüssel** eintragen (Schlüssel auf <https://platform.claude.com> erstellen).

Jede Änderung, die nach `main` gepusht wird, wird automatisch neu veröffentlicht. Deine Daten auf dem iPhone bleiben dabei erhalten.

## Entwicklung

```powershell
npm install
npm run dev      # http://localhost:3000
npm test         # Unit-Tests (Wochen, Domainfilter, Bibelstellen, Parser, Quellenbindung)
npm run build    # statischer Export nach ./out
npm run icons    # App-Icons aus public/icons/*.svg erzeugen
```

Für einen lokalen Test unter dem GitHub-Pfad: `NEXT_PUBLIC_BASE_PATH=/jw-study-companion` setzen und `out` in einen Unterordner `jw-study-companion` eines statischen Servers legen.

## Kosten der KI

Abrechnung direkt über dein Anthropic-Konto. Grobe Schätzung (nicht gemessen): eine komplette Woche (≈ 17 Absätze + ≈ 10 Programmpunkte) mit Claude Opus 5.5 etwa 0,50–1,50 USD; mit Sonnet 5.5 bzw. Haiku 5.5 deutlich weniger (Einstellungen → Modell). Ganze Ausgaben per KI zu importieren und die jw.org-Suche verursachen zusätzliche Kosten.

## Projektstruktur

```
src/app/(app)/        Seiten (Woche, Programmpunkt, Absatz, Import, Favoriten, Archiv, Einstellungen)
src/components/       Oberfläche (Studienansicht, Import-Assistent, Navigation, Branding, shadcn/ui)
src/lib/actions.ts    Alle Aktionen (laufen im Browser)
src/lib/data/         Speicher auf dem Gerät (IndexedDB) + Sicherung
src/lib/ai/           Claude: Antworten, Kommentare, Assistent, Import-Erkennung, jw.org-Suche, Quellenbindung
src/lib/import/       Parser, Wörtlichkeitsprüfung
src/lib/sources/      jw.org-Domainfilter, offizielle Links
src/lib/week.ts       ISO-Kalenderwochen, Europe/Vienna
public/sw.js          Offline-Unterstützung
.github/workflows/    Automatische Veröffentlichung auf GitHub Pages
```
