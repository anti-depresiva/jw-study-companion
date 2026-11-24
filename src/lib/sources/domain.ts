/**
 * Technische Quellenbeschränkung auf jw.org (Abschnitt 16.7).
 * Jede URL, die gespeichert, angezeigt oder abgerufen wird, läuft hier durch.
 */

/** Ausdrücklich zugelassene Hosts. Keine Wildcards. */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "jw.org",
  "www.jw.org",
  "wol.jw.org", // Online-Bibliothek von Jehovas Zeugen
]);

/** Domain-Liste für die Web-Suche der Claude-API (deckt Subdomains ab). */
export const SEARCH_ALLOWED_DOMAINS = ["jw.org"];

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

export function checkOfficialUrl(input: unknown): UrlCheck {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, reason: "Keine URL angegeben." };
  }
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "Ungültige URL." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Nur HTTPS-Adressen sind erlaubt." };
  if (url.username || url.password) return { ok: false, reason: "URLs mit Zugangsdaten sind nicht erlaubt." };
  if (url.port && url.port !== "443") return { ok: false, reason: "Nicht-Standard-Port ist nicht erlaubt." };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, reason: `Nur offizielle jw.org-Adressen sind erlaubt (gefunden: ${host}).` };
  }
  return { ok: true, url: url.toString() };
}

export function isOfficialUrl(input: unknown): input is string {
  return checkOfficialUrl(input).ok;
}

/**
 * Prüft, ob ein offizieller Link erreichbar ist – genau EIN Request, vom
 * Benutzer ausgelöst, ohne automatische Weiterleitungen. Weiterleitungen
 * werden nur gemeldet, wenn ihr Ziel ebenfalls auf jw.org liegt.
 * Es wird kein Inhalt gespeichert oder ausgewertet.
 */
export async function verifyOfficialLink(
  input: string,
): Promise<{ ok: boolean; status?: number; finalUrl?: string; reason?: string }> {
  const check = checkOfficialUrl(input);
  if (!check.ok) return { ok: false, reason: check.reason };
  let current = check.url;
  for (let hop = 0; hop < 3; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "JW-Plus-Study-Companion/1.0 (Linkpruefung)" },
      });
    } catch {
      return { ok: false, reason: "Seite nicht erreichbar." };
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: false, status: res.status, reason: "Weiterleitung ohne Ziel." };
      const next = checkOfficialUrl(new URL(location, current).toString());
      if (!next.ok) return { ok: false, status: res.status, reason: "Weiterleitung auf fremde Domain blockiert." };
      current = next.url;
      continue;
    }
    return res.ok
      ? { ok: true, status: res.status, finalUrl: current }
      : { ok: false, status: res.status, reason: `Server antwortete mit ${res.status}.` };
  }
  return { ok: false, reason: "Zu viele Weiterleitungen." };
}
