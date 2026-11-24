import { checkOfficialUrl } from "./domain";

/**
 * Offizielle Link-Muster. Diese Links werden NICHT als „geprüft“ gespeichert,
 * sondern als „Linkmuster – ungeprüft“, bis der Benutzer sie bestätigt, die
 * Linkprüfung erfolgreich war oder die jw.org-Suche sie bestätigt hat.
 */

/** Wochenübersicht „Zusammenkünfte“ in der Online-Bibliothek (Deutsch). */
export function wolMeetingsUrl(year: number, week: number): string {
  return `https://wol.jw.org/de/wol/meetings/r10/lp-x/${year}/${week}`;
}

/** Übersicht aller Arbeitshefte auf jw.org. */
export const WORKBOOK_INDEX_URL = "https://www.jw.org/de/bibliothek/jw-arbeitsheft/";

/** Übersicht der Wachtturm-Ausgaben auf jw.org. */
export const MAGAZINE_INDEX_URL = "https://www.jw.org/de/bibliothek/zeitschriften/";

/**
 * Suche nach einer Bibelstelle in der offiziellen Online-Bibliothek.
 * Es wird keine Dokument-URL konstruiert, sondern die Suchfunktion von
 * wol.jw.org mit der Stellenangabe aufgerufen.
 */
export function bibleLookupUrl(reference: string): string {
  const url = `https://wol.jw.org/de/wol/l/r10/lp-x?q=${encodeURIComponent(reference)}`;
  const check = checkOfficialUrl(url);
  if (!check.ok) throw new Error(check.reason);
  return check.url;
}

/** Bibel-Startseite auf jw.org je nach gewählter Übersetzung. */
export function bibleHomeUrl(translation: "nwtsty" | "nwt"): string {
  return translation === "nwtsty"
    ? "https://www.jw.org/de/bibliothek/bibel/studienbibel/"
    : "https://www.jw.org/de/bibliothek/bibel/nwt/";
}
