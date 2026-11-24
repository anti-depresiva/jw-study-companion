import type { BetaMessage, BetaMessageParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { checkOfficialUrl, SEARCH_ALLOWED_DOMAINS } from "@/lib/sources/domain";
import { assertSourceReady, type ResolvedTarget } from "@/lib/study/targets";
import { assertUsable, FALLBACK_BETA, getClient, model, textOf } from "./client";
import { allowedRefs, checkGrounding } from "./grounding";
import { articleContext, SYSTEM_PROMPT, workbookContext } from "./prompts";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface FoundSource {
  title: string;
  url: string;
}

export const jwSearchTool = (maxUses: number): BetaToolUnion => ({
  type: "web_search_20260209",
  name: "web_search",
  max_uses: maxUses,
  allowed_domains: SEARCH_ALLOWED_DOMAINS,
});

/** Sammelt alle URLs aus Suchergebnissen und Zitaten – nur jw.org wird übernommen. */
export function collectOfficialSources(message: BetaMessage): { sources: FoundSource[]; blocked: number } {
  const found = new Map<string, FoundSource>();
  let blocked = 0;
  const add = (url: unknown, title: unknown) => {
    const check = checkOfficialUrl(url);
    if (!check.ok) {
      if (url) blocked++;
      return;
    }
    if (!found.has(check.url)) found.set(check.url, { url: check.url, title: String(title || check.url) });
  };
  for (const block of message.content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === "web_search_result") add(r.url, r.title);
    }
    if (block.type === "text" && block.citations) {
      for (const c of block.citations) if ("url" in c) add(c.url, "title" in c ? c.title : null);
    }
  }
  return { sources: [...found.values()], blocked };
}

const ASSISTANT_RULES = `
Zusätzlich für den Dialog:
- Beantworte Fragen zum bereitgestellten Abschnitt: erkläre Bibelstellen im Kontext, arbeite Gedanken heraus, formuliere Kommentare oder praktische Anwendungen.
- Kennzeichne deine Antwort klar: Was steht im Originaltext („Laut Absatz …“), was ist deine Formulierung bzw. ein zusätzlicher Gedanke?
- Wenn du die jw.org-Suche verwendest, stütze dich nur auf Seiten von jw.org und nenne sie.
- Wenn weder das Material noch jw.org die Frage beantwortet, antworte genau mit: „Dazu konnte keine passende offizielle Quelle auf jw.org gefunden werden.“
- Antworte knapp und in einfachem Fließtext ohne Markdown-Überschriften.`;

export async function askAssistant(
  t: ResolvedTarget,
  history: ChatTurn[],
  useWebSearch: boolean,
): Promise<{ text: string; sources: FoundSource[]; blocked: number; warnings: string[] }> {
  assertSourceReady(t);
  const context =
    (t.type === "paragraph" ? articleContext(t.article) : workbookContext(t.workbook)) +
    `\n\nDer Benutzer fragt zu: ${t.label}${t.question ? ` – Originalfrage: ${t.question}` : ""}`;

  const messages: BetaMessageParam[] = history.map((turn, i) =>
    i === 0 && turn.role === "user"
      ? {
          role: "user",
          content: [
            { type: "text", text: context, cache_control: { type: "ephemeral" } },
            { type: "text", text: turn.content },
          ],
        }
      : { role: turn.role, content: turn.content },
  );

  const client = getClient();
  let message: BetaMessage | null = null;
  // pause_turn: Server-Tool-Schleife fortsetzen (max. 3 Runden)
  for (let round = 0; round < 3; round++) {
    message = await client.beta.messages
      .stream({
        model: model(),
        max_tokens: 8000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: SYSTEM_PROMPT + ASSISTANT_RULES, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium" },
        tools: useWebSearch ? [jwSearchTool(4)] : undefined,
        messages,
      })
      .finalMessage();
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }
  if (!message) throw new Error("Keine Antwort erhalten.");
  assertUsable(message);

  const text = textOf(message);
  const { sources, blocked } = collectOfficialSources(message);
  const allowed = allowedRefs(t.originalText, t.question, t.type === "paragraph" ? t.article.themeScripture : t.workbook.bibleReading);
  const warnings: string[] = [];
  const grounding = checkGrounding([text], allowed);
  if (!grounding.ok) {
    warnings.push(
      sources.length
        ? `Bibelstelle(n) außerhalb des Abschnitts: ${grounding.invented.join(", ")} – bitte anhand der genannten jw.org-Quellen prüfen.`
        : `Nicht im Originaltext belegte Bibelstelle(n): ${grounding.invented.join(", ")} – bitte prüfen.`,
    );
  }
  if (blocked) warnings.push(`${blocked} Fundstelle(n) außerhalb von jw.org wurden verworfen.`);
  return { text, sources, blocked, warnings };
}
