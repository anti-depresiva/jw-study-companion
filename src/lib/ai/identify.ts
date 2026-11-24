import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { checkOfficialUrl } from "@/lib/sources/domain";
import { formatRange, type WeekRange } from "@/lib/week";
import { assertUsable, FALLBACK_BETA, getClient, model, textOf } from "./client";
import { collectOfficialSources, jwSearchTool } from "./assistant";

export interface IdentifiedSource {
  kind: "watchtower" | "workbook";
  title: string;
  url: string;
  issue: string | null;
}

const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();

/**
 * Quellenerkennung über die auf jw.org beschränkte Websuche der Claude-API.
 * Eine URL wird NUR übernommen, wenn sie (a) auf jw.org liegt und (b) exakt
 * in den Suchergebnissen vorkommt – von der KI „ausgedachte“ Links werden so
 * technisch ausgeschlossen.
 */
export async function identifyWeekSources(week: WeekRange): Promise<{ found: IdentifiedSource[]; notes: string[] }> {
  const range = formatRange(week.start, week.end);
  const messages: BetaMessageParam[] = [
    {
      role: "user",
      content: `Suche auf jw.org (deutsche Seiten) nach den offiziellen Studienmaterialien für die Woche ${range} (ISO-KW ${week.week}/${week.year}):
1. das Wochenprogramm im Arbeitsheft „Unser Leben und Dienst als Christ“ für diese Woche,
2. den Wachtturm-Studienartikel (Studienausgabe), der in dieser Woche studiert wird.
Antworte am Ende ausschließlich mit JSON in dieser Form:
{"workbook": {"title": "...", "url": "..."} | null, "watchtower": {"title": "...", "url": "...", "issue": "..."} | null}
Verwende nur URLs, die in deinen Suchergebnissen vorkommen. Wenn du etwas nicht sicher findest, setze null.`,
    },
  ];

  const client = getClient();
  let message: BetaMessage | null = null;
  const all: BetaMessage[] = [];
  for (let round = 0; round < 3; round++) {
    message = await client.beta.messages
      .stream({
        model: model(),
        max_tokens: 6000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "low" },
        tools: [jwSearchTool(6)],
        messages,
      })
      .finalMessage();
    all.push(message);
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }
  if (!message) return { found: [], notes: ["Keine Antwort der Suche."] };
  assertUsable(message);

  const searchUrls = new Set<string>();
  let blocked = 0;
  for (const m of all) {
    const c = collectOfficialSources(m);
    c.sources.forEach((s) => searchUrls.add(norm(s.url)));
    blocked += c.blocked;
  }

  const notes: string[] = [];
  if (blocked) notes.push(`${blocked} Treffer außerhalb von jw.org verworfen.`);
  const raw = textOf(message).match(/\{[\s\S]*\}\s*$/)?.[0];
  let data: Record<string, { title?: string; url?: string; issue?: string } | null> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    notes.push("Die Suchantwort konnte nicht ausgewertet werden.");
  }

  const found: IdentifiedSource[] = [];
  for (const kind of ["workbook", "watchtower"] as const) {
    const entry = data[kind];
    if (!entry?.url) {
      notes.push(kind === "workbook" ? "Arbeitsheft-Woche nicht gefunden." : "Wachtturm-Studienartikel nicht gefunden.");
      continue;
    }
    const check = checkOfficialUrl(entry.url);
    if (!check.ok) {
      notes.push(`Verworfen (${check.reason}).`);
      continue;
    }
    if (!searchUrls.has(norm(check.url))) {
      notes.push(`Verworfen: ${check.url} kam in keinem Suchergebnis vor.`);
      continue;
    }
    found.push({ kind, title: entry.title?.slice(0, 300) || check.url, url: check.url, issue: entry.issue?.slice(0, 100) || null });
  }
  return { found, notes };
}
