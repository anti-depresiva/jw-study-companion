/**
 * Abruf einer Seite der Online-Bibliothek (wol.jw.org) über Claudes Web-Fetch-Werkzeug.
 * Der Abruf erfolgt durch Anthropics Server (nur jw.org erlaubt), ausgelöst per Knopfdruck.
 * Verwendet wird der vom Werkzeug gelieferte ORIGINALTEXT der Seite – nicht Claudes
 * Formulierung –, damit Fragen und Absätze wörtlich übernommen werden können.
 */
import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { assertUsable, FALLBACK_BETA, getClient, model } from "./client";
import { jwFetchTool } from "./assistant";

export class WolFetchError extends Error {}

const ERRORS: Record<string, string> = {
  url_not_accessible: "Die Seite war für den Abruf nicht erreichbar (evtl. blockiert jw.org automatische Abrufe).",
  url_not_allowed: "Diese Adresse ist für den Abruf nicht erlaubt.",
  too_many_requests: "Zu viele Abrufe – bitte später erneut versuchen.",
  unavailable: "Der Abrufdienst ist gerade nicht verfügbar.",
  content_too_large: "Die Seite ist zu groß für den Abruf.",
  unsupported_content_type: "Die Seite hat ein nicht unterstütztes Format.",
};

export interface FetchedPage {
  url: string;
  title: string | null;
  text: string;
}

/** Ruft genau eine jw.org-Seite ab und liefert ihren Text. */
export async function fetchJwPage(url: string): Promise<FetchedPage> {
  const check = checkOfficialUrl(url);
  if (!check.ok) throw new WolFetchError(check.reason);

  const messages: BetaMessageParam[] = [
    {
      role: "user",
      content: `Rufe genau diese Seite mit dem Werkzeug web_fetch ab: ${check.url}\nGib danach nur „fertig“ aus. Keine weiteren Abrufe, keine Zusammenfassung.`,
    },
  ];
  const client = getClient();
  let message: BetaMessage | null = null;
  for (let round = 0; round < 3; round++) {
    message = await client.beta.messages
      .stream({
        model: model(),
        max_tokens: 2000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "low" },
        tools: [jwFetchTool(1, 120_000)],
        messages,
      })
      .finalMessage();
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }
  if (!message) throw new WolFetchError("Keine Antwort erhalten.");
  assertUsable(message);

  for (const block of message.content) {
    if (block.type !== "web_fetch_tool_result") continue;
    if (block.content.type === "web_fetch_tool_result_error") {
      throw new WolFetchError(ERRORS[block.content.error_code] ?? `Abruf fehlgeschlagen (${block.content.error_code}).`);
    }
    const final = checkOfficialUrl(block.content.url);
    if (!final.ok) throw new WolFetchError("Der Abruf wurde auf eine fremde Seite umgeleitet und verworfen.");
    const source = block.content.content.source;
    if (source.type !== "text") throw new WolFetchError("Die Seite wurde nicht als Text geliefert.");
    return { url: final.url, title: block.content.content.title, text: source.data };
  }
  throw new WolFetchError("Die Seite wurde nicht abgerufen.");
}

/** Text aus Markdown/HTML-Resten säubern (Überschriften, Fettdruck, Links → nur Text). */
export function cleanFetchedText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // Bilder
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // Links → Linktext
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$|[.,;:!?)])/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Link auf das Studienmaterial des Versammlungsbibelstudiums: erster Dokumentlink
 * zwischen „Versammlungsbibelstudium“ und „Schlussworte“ bzw. „Wachtturm-Studium“.
 */
export function findCongregationStudyUrl(md: string, base: string): string | null {
  const start = md.search(/Versammlungsbibelstudium/i);
  if (start < 0) return null;
  const rest = md.slice(start);
  const stop = rest.slice(25).search(/Schlussworte|Wachtturm[- ]Studium|Zusammenkunft am Wochenende/i);
  const section = stop >= 0 ? rest.slice(0, stop + 25) : rest.slice(0, 1500);
  for (const m of section.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (!/\/wol\/(d|pc)\//.test(m[2])) continue;
    try {
      const abs = new URL(m[2], base).toString();
      if (checkOfficialUrl(abs).ok) return abs;
    } catch {
      /* ungültiger Link */
    }
  }
  return null;
}

/** „Abs. 1-7“ / „Abs. 8–14“ im Programmpunkt → Absatzbereich */
export function paragraphRange(text: string): [number, number] | null {
  const m = text.match(/Abs\.\s*(\d+)\s*[-–]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Link auf den Wachtturm-Studienartikel der Woche aus der Zusammenkünfte-Seite. */
export function findStudyArticleUrl(md: string, base: string): string | null {
  const links = [...md.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({ text: m[1], href: m[2] }));
  // Der Studienartikel steht im Abschnitt „Wachtturm-Studium“; Dokumentlinks enthalten /wol/d/
  const idx = md.search(/Wachtturm[- ]Studium|WACHTTURM[- ]STUDIUM/i);
  const after = idx >= 0 ? md.slice(idx) : md;
  const candidates = [...after.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => m[2]).concat(links.map((l) => l.href));
  for (const href of candidates) {
    if (!/\/wol\/d\//.test(href)) continue;
    try {
      const abs = new URL(href, base).toString();
      if (checkOfficialUrl(abs).ok) return abs;
    } catch {
      /* ungültiger Link */
    }
  }
  return null;
}

